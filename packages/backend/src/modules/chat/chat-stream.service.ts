import type { ChatStreamEvent } from "share";
import type { ModelSelectionInput } from "share";
import {
    type ChatRunStore,
    type PersistedRunStatus,
    createChatRunStore,
} from "./chat-run.store.js";
import {
    resolveModelSelection,
    type ResolvedModelConfig,
} from "../model/model-service.js";
import { retrieveFromIndexedDocuments, type RetrievalHit } from "../rag/document-index.js";
import {
    logUpstreamHttpError,
    readUpstreamError,
} from "../model/upstream-error.js";

type State =
    | "QUEUED"
    | "RETRIEVING"
    | "GENERATING"
    | "TOOL_RUNNING"
    | "DONE"
    | "FAILED"
    | "CANCELED";

type EventType =
    | { type: "START_RETRIEVAL" }
    | { type: "RETRIEVAL_OK"; hits: RetrievalHit[] }
    | { type: "RETRIEVAL_ERR"; error: string }
    | { type: "START_GENERATION" }
    | { type: "TOKEN"; text: string; chunkType?: "content" | "reasoning" }
    | { type: "TOOL_CALL"; tool: string; args: object }
    | { type: "TOOL_OK"; result: string }
    | { type: "TOOL_ERR"; error: string }
    | { type: "MODEL_DONE" }
    | { type: "MODEL_ERR"; error: string }
    | { type: "CLIENT_CANCEL" }
    | { type: "TIMEOUT" };

interface RunContext {
    runId: string;
    prompt: string;
    state: State;
    chunkIndex: number;
    output: string;
    retrievalHits: RetrievalHit[];
    startedAt: number;
    updatedAt: number;
    errorMessage: string | null;
}

const TERMINAL_STATES: ReadonlySet<State> = new Set([
    "DONE",
    "FAILED",
    "CANCELED",
]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getChatStreamTimeoutMs(): number {
    const raw = Number(process.env.CHAT_STREAM_TIMEOUT_MS ?? "180000");
    if (!Number.isFinite(raw)) {
        return 180000;
    }

    // Keep a reasonable lower bound to avoid accidental tiny timeout values.
    return Math.max(30000, Math.floor(raw));
}

function isTerminalState(state: State): boolean {
    return TERMINAL_STATES.has(state);
}

function isAbortError(err: unknown): boolean {
    return err instanceof Error && err.name === "AbortError";
}

function mapStateToPersistedStatus(state: State): PersistedRunStatus {
    switch (state) {
        case "QUEUED":
            return "QUEUED";
        case "RETRIEVING":
        case "TOOL_RUNNING":
            return "RUNNING";
        case "GENERATING":
            return "STREAMING";
        case "DONE":
            return "SUCCEEDED";
        case "FAILED":
            return "FAILED";
        case "CANCELED":
            return "CANCELED";
    }
}

/**
 * Pure transition function.
 * It only answers "what is the next state" and never performs side effects.
 */
function transition(state: State, event: EventType): State {
    if (isTerminalState(state)) {
        throw new Error(
            `Cannot transition from terminal state ${state} with event ${event.type}`,
        );
    }

    if (event.type === "CLIENT_CANCEL") {
        return "CANCELED";
    }

    if (event.type === "TIMEOUT") {
        return "FAILED";
    }

    switch (state) {
        case "QUEUED":
            if (event.type === "START_RETRIEVAL") {
                return "RETRIEVING";
            }
            if (event.type === "MODEL_ERR") {
                return "FAILED";
            }
            break;
        case "RETRIEVING":
            if (event.type === "RETRIEVAL_OK") {
                return "GENERATING";
            }
            if (event.type === "RETRIEVAL_ERR") {
                return "FAILED";
            }
            break;
        case "GENERATING":
            if (event.type === "START_GENERATION") {
                return "GENERATING";
            }
            if (event.type === "TOKEN") {
                return "GENERATING";
            }
            if (event.type === "TOOL_CALL") {
                return "TOOL_RUNNING";
            }
            if (event.type === "MODEL_DONE") {
                return "DONE";
            }
            if (event.type === "MODEL_ERR") {
                return "FAILED";
            }
            break;
        case "TOOL_RUNNING":
            if (event.type === "TOOL_OK") {
                return "GENERATING";
            }
            if (event.type === "TOOL_ERR") {
                return "FAILED";
            }
            break;
        case "DONE":
        case "FAILED":
        case "CANCELED":
            break;
    }

    throw new Error(
        `Invalid transition from ${state} with event ${JSON.stringify(event)}`,
    );
}

/**
 * Applies event to run context after validating transition.
 * This keeps context mutations deterministic and testable.
 */
function applyEvent(ctx: RunContext, event: EventType): void {
    ctx.state = transition(ctx.state, event);
    ctx.updatedAt = Date.now();

    switch (event.type) {
        case "RETRIEVAL_OK":
            ctx.retrievalHits = event.hits;
            return;
        case "TOKEN":
            ctx.chunkIndex += 1;
            ctx.output += event.text;
            return;
        case "TOOL_OK":
            ctx.output += `\n[tool-result] ${event.result}\n`;
            return;
        case "RETRIEVAL_ERR":
        case "TOOL_ERR":
        case "MODEL_ERR":
            ctx.errorMessage = event.error;
            return;
        case "CLIENT_CANCEL":
            ctx.errorMessage = "Stream canceled by client";
            return;
        case "TIMEOUT":
            ctx.errorMessage = "Stream timed out";
            return;
        default:
            return;
    }
}

/**
 * Handwritten keyword retrieval baseline.
 * This gives you a no-SDK retrieval implementation before vector DB integration.
 */
async function retrieveContext(prompt: string): Promise<RetrievalHit[]> {
    await sleep(20);
    return retrieveFromIndexedDocuments(prompt);
}

/**
 * Minimal handwritten tool runner.
 * Convention:
 * - Prompt starts with "/tool time"   -> returns current ISO time
 * - Prompt starts with "/tool echo xxx" -> returns echo text
 */
async function runToolFromPrompt(prompt: string): Promise<string | null> {
    if (prompt.startsWith("/tool time")) {
        return new Date().toISOString();
    }

    if (prompt.startsWith("/tool echo")) {
        return prompt.replace("/tool echo", "").trim() || "(empty)";
    }

    return null;
}

/**
 * Parses SSE wire format from model providers.
 * Input stream format:
 *   data: {...}\n\n
 *   data: [DONE]\n\n
 */
async function* parseSseDataLines(
    body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) {
            break;
        }

        buffer += decoder.decode(value, { stream: true });

        while (true) {
            const delimiterIndex = buffer.indexOf("\n\n");
            if (delimiterIndex === -1) {
                break;
            }

            const rawEvent = buffer.slice(0, delimiterIndex);
            buffer = buffer.slice(delimiterIndex + 2);

            const dataLines = rawEvent
                .split("\n")
                .filter((line) => line.startsWith("data:"))
                .map((line) => line.slice(5).trim());

            if (dataLines.length === 0) {
                continue;
            }

            yield dataLines.join("\n");
        }
    }

    const trailing = buffer.trim();
    if (trailing.startsWith("data:")) {
        yield trailing.slice(5).trim();
    }
}

/**
 * Streams model tokens without any SDK.
 * If env vars are missing, it falls back to mock token streaming so the pipeline stays testable.
 */
async function* streamModelTokens(
    ctx: RunContext,
    retrievalHits: RetrievalHit[],
    signal: AbortSignal,
    modelConfig: ResolvedModelConfig,
): AsyncGenerator<{ chunkType: "content" | "reasoning"; text: string }> {
    // OpenAI-compatible payload (handwritten HTTP call, no SDK).
    const response = await fetch(modelConfig.endpoint, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${modelConfig.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: modelConfig.model,
            stream: true,
            messages: [
                {
                    role: "system",
                    content: retrievalHits.length
                        ? `Use retrieved context when relevant:\n${retrievalHits
                              .map((h, i) => `${i + 1}. ${h.text}`)
                              .join("\n")}`
                        : "No additional retrieved context.",
                },
                { role: "user", content: ctx.prompt },
            ],
        }),
        signal,
    });

    if (!response.ok) {
        const errorText = await readUpstreamError(response);
        logUpstreamHttpError(
            {
                scope: "chat-stream",
                endpoint: modelConfig.endpoint,
                model: modelConfig.model,
                source: modelConfig.source,
            },
            errorText,
        );
        throw new Error(errorText);
    }

    if (!response.body) {
        throw new Error("Model stream body is empty");
    }

    for await (const data of parseSseDataLines(response.body)) {
        if (data === "[DONE]") {
            break;
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(data);
        } catch {
            continue;
        }

        const delta = (
            parsed as {
                choices?: Array<{
                    delta?: {
                        content?: string;
                        reasoning?: string;
                        reasoning_content?: string;
                    };
                }>;
            }
        ).choices?.[0]?.delta;

        const reasoningToken =
            delta?.reasoning_content ?? delta?.reasoning ?? "";
        if (reasoningToken.length > 0) {
            yield { chunkType: "reasoning", text: reasoningToken };
        }

        const contentToken = delta?.content ?? "";
        if (contentToken) {
            yield { chunkType: "content", text: contentToken };
        }
    }
}

export class ChatStreamService {
    private readonly canceledRuns = new Set<string>();
    private readonly maxRunMs = getChatStreamTimeoutMs();
    private readonly runStore: ChatRunStore;

    constructor(runStore: ChatRunStore = createChatRunStore()) {
        this.runStore = runStore;
    }

    cancelRun(runId: string): void {
        this.canceledRuns.add(runId);
        void this.runStore.appendEvent(runId, "CLIENT_CANCEL_REQUESTED");
    }

    getRun(runId: string) {
        return this.runStore.getRun(runId);
    }

    listRuns() {
        return this.runStore.listRuns();
    }

    deleteRun(runId: string) {
        return this.runStore.deleteRun(runId);
    }

    createStream(
        prompt: string,
        signal: AbortSignal,
        modelSelection?: ModelSelectionInput,
    ): ReadableStream<Uint8Array> {
        const runId = `run_${Date.now()}`;
        const encoder = new TextEncoder();
        const ctx: RunContext = {
            runId,
            prompt,
            state: "QUEUED",
            chunkIndex: 0,
            output: "",
            retrievalHits: [],
            startedAt: Date.now(),
            updatedAt: Date.now(),
            errorMessage: null,
        };

        return new ReadableStream<Uint8Array>({
            start: (controller) => {
                let closed = false;
                const closeIfNeeded = () => {
                    if (closed) {
                        return;
                    }
                    closed = true;
                    controller.close();
                };

                const sendEvent = (event: ChatStreamEvent) => {
                    if (closed) {
                        return;
                    }
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
                    );
                };

                sendEvent({
                    type: "run_start",
                    runId,
                    ts: Date.now(),
                });

                /**
                 * Single event gateway for state machine:
                 * 1) validate and apply transition
                 * 2) project internal state changes to SSE messages
                 */
                const dispatch = async (event: EventType) => {
                    if (isTerminalState(ctx.state)) {
                        return;
                    }

                    applyEvent(ctx, event);
                    await this.runStore.appendEvent(ctx.runId, event.type);
                    await this.runStore.updateRun(ctx.runId, {
                        status: mapStateToPersistedStatus(ctx.state),
                        outputSummary: ctx.output.slice(-1200),
                        retrievalHits: ctx.retrievalHits.map((h) => h.text),
                        errorMessage: ctx.errorMessage,
                        finishedAt: isTerminalState(ctx.state)
                            ? new Date().toISOString()
                            : null,
                    });

                    if (event.type === "RETRIEVAL_OK") {
                        sendEvent({
                            type: "retrieval_hits",
                            runId: ctx.runId,
                            hits: event.hits.map((h) => ({
                                documentId: h.documentId,
                                documentTitle: h.documentTitle,
                                content: h.content,
                                score: h.score,
                            })),
                        });
                        return;
                    }

                    if (event.type === "TOKEN") {
                        sendEvent({
                            type: "chunk",
                            runId: ctx.runId,
                            index: ctx.chunkIndex,
                            content: event.text,
                            chunkType: event.chunkType,
                        });
                        return;
                    }

                    if (event.type === "MODEL_DONE") {
                        sendEvent({ type: "done", runId: ctx.runId });
                        return;
                    }

                    if (
                        event.type === "RETRIEVAL_ERR" ||
                        event.type === "TOOL_ERR" ||
                        event.type === "MODEL_ERR" ||
                        event.type === "CLIENT_CANCEL" ||
                        event.type === "TIMEOUT"
                    ) {
                        sendEvent({
                            type: "error",
                            runId: ctx.runId,
                            message: ctx.errorMessage ?? "Unknown stream error",
                        });
                    }
                };

                const heartbeat = setInterval(() => {
                    sendEvent({ type: "heartbeat", runId, ts: Date.now() });
                }, 5000);

                const timeout = setTimeout(() => {
                    if (!isTerminalState(ctx.state)) {
                        void dispatch({ type: "TIMEOUT" });
                    }
                }, this.maxRunMs);

                void (async () => {
                    try {
                        await this.runStore.createRun(runId, prompt);

                        const resolvedModelConfig =
                            await resolveModelSelection(modelSelection);

                        if (!resolvedModelConfig) {
                            throw new Error(
                                "Model config is required. Select a service or set server default env.",
                            );
                        }

                        await dispatch({ type: "START_RETRIEVAL" });

                        let hits: RetrievalHit[] = [];
                        try {
                            hits = await retrieveContext(ctx.prompt);
                        } catch (err) {
                            const message =
                                err instanceof Error
                                    ? err.message
                                    : "Retrieval failed";
                            await dispatch({
                                type: "RETRIEVAL_ERR",
                                error: message,
                            });
                            return;
                        }

                        if (this.canceledRuns.has(runId)) {
                            await dispatch({ type: "CLIENT_CANCEL" });
                            return;
                        }

                        await dispatch({ type: "RETRIEVAL_OK", hits });
                        await dispatch({ type: "START_GENERATION" });

                        const toolResult = await runToolFromPrompt(ctx.prompt);
                        if (toolResult) {
                            await dispatch({
                                type: "TOOL_CALL",
                                tool: "local.tool",
                                args: { prompt: ctx.prompt },
                            });
                            await dispatch({
                                type: "TOOL_OK",
                                result: toolResult,
                            });
                            await dispatch({
                                type: "TOKEN",
                                text: `[tool] ${toolResult}\n`,
                            });
                        }

                        for await (const token of streamModelTokens(
                            ctx,
                            hits,
                            signal,
                            resolvedModelConfig,
                        )) {
                            if (this.canceledRuns.has(runId)) {
                                await dispatch({ type: "CLIENT_CANCEL" });
                                return;
                            }

                            await dispatch({
                                type: "TOKEN",
                                text: token.text,
                                chunkType: token.chunkType,
                            });
                        }

                        await dispatch({ type: "MODEL_DONE" });
                    } catch (err) {
                        if (this.canceledRuns.has(runId) || isAbortError(err)) {
                            await dispatch({ type: "CLIENT_CANCEL" });
                        } else {
                            const message =
                                err instanceof Error
                                    ? err.message
                                    : "Unknown stream error";
                            await dispatch({
                                type: "MODEL_ERR",
                                error: message,
                            });
                        }
                    } finally {
                        this.canceledRuns.delete(runId);
                        clearInterval(heartbeat);
                        clearTimeout(timeout);
                        closeIfNeeded();
                    }
                })();

                signal.addEventListener("abort", () => {
                    this.canceledRuns.add(runId);
                    if (!isTerminalState(ctx.state)) {
                        void dispatch({ type: "CLIENT_CANCEL" });
                    }
                    clearInterval(heartbeat);
                    clearTimeout(timeout);
                    closeIfNeeded();
                });
            },
            cancel: () => {
                this.canceledRuns.add(runId);
            },
        });
    }
}

export const chatStreamService = new ChatStreamService();
