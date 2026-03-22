import { InMemoryTaskQueue } from "../../core/queue/in-memory-task-queue.js";
const TERMINAL_STATES = new Set([
    "DONE",
    "FAILED",
    "CANCELED",
]);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// In-memory corpus used for a handwritten keyword retrieval baseline.
const KNOWLEDGE_DOCS = [
    "RAG pipeline: chunking -> embedding -> retrieval -> generation",
    "State machine: explicit transitions and terminal state guards",
    "SSE streaming: send 'data:' lines and terminate with blank line separators",
    "Task queues decouple request lifecycle from generation workloads",
    "Type-safe API contracts reduce frontend/backend drift",
    "Use AbortSignal for cooperative cancel in streaming workloads",
];
function isTerminalState(state) {
    return TERMINAL_STATES.has(state);
}
function isAbortError(err) {
    return err instanceof Error && err.name === "AbortError";
}
function buildModelConfigFromEnv() {
    const endpoint = process.env.LLM_API_ENDPOINT;
    const model = process.env.LLM_API_MODEL;
    const apiKey = process.env.LLM_API_KEY;
    if (!endpoint || !model || !apiKey) {
        return null;
    }
    return { endpoint, model, apiKey };
}
/**
 * Pure transition function.
 * It only answers "what is the next state" and never performs side effects.
 */
function transition(state, event) {
    if (isTerminalState(state)) {
        throw new Error(`Cannot transition from terminal state ${state} with event ${event.type}`);
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
    throw new Error(`Invalid transition from ${state} with event ${JSON.stringify(event)}`);
}
/**
 * Applies event to run context after validating transition.
 * This keeps context mutations deterministic and testable.
 */
function applyEvent(ctx, event) {
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
async function retrieveContext(prompt) {
    const tokens = prompt
        .toLowerCase()
        .split(/\W+/)
        .filter((t) => t.length >= 3);
    if (tokens.length === 0) {
        return [];
    }
    const scored = KNOWLEDGE_DOCS.map((doc) => {
        const lowered = doc.toLowerCase();
        const score = tokens.reduce((acc, token) => acc + (lowered.includes(token) ? 1 : 0), 0);
        return { doc, score };
    })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map((item) => item.doc);
    await sleep(40);
    return scored;
}
/**
 * Minimal handwritten tool runner.
 * Convention:
 * - Prompt starts with "/tool time"   -> returns current ISO time
 * - Prompt starts with "/tool echo xxx" -> returns echo text
 */
async function runToolFromPrompt(prompt) {
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
async function* parseSseDataLines(body) {
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
async function* streamModelTokens(ctx, retrievalHits, signal) {
    const modelConfig = buildModelConfigFromEnv();
    // Fallback mode keeps your state machine exercisable without external dependency.
    if (!modelConfig) {
        const base = retrievalHits.length
            ? `context: ${retrievalHits.join(" | ")}`
            : "context: none";
        const fakeOutput = `${base}\nreply: ${ctx.prompt}`;
        const chunks = fakeOutput.match(/.{1,16}/g) ?? [fakeOutput];
        for (const piece of chunks) {
            if (signal.aborted) {
                throw new DOMException("Aborted", "AbortError");
            }
            await sleep(110);
            yield `${piece}`;
        }
        return;
    }
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
                            .map((h, i) => `${i + 1}. ${h}`)
                            .join("\n")}`
                        : "No additional retrieved context.",
                },
                { role: "user", content: ctx.prompt },
            ],
        }),
        signal,
    });
    if (!response.ok) {
        throw new Error(`Model HTTP error: ${response.status}`);
    }
    if (!response.body) {
        throw new Error("Model stream body is empty");
    }
    for await (const data of parseSseDataLines(response.body)) {
        if (data === "[DONE]") {
            break;
        }
        let parsed;
        try {
            parsed = JSON.parse(data);
        }
        catch {
            continue;
        }
        const token = parsed
            .choices?.[0]?.delta?.content ?? "";
        if (token) {
            yield token;
        }
    }
}
export class ChatStreamService {
    queue = new InMemoryTaskQueue();
    canceledRuns = new Set();
    maxRunMs = 30_000;
    cancelRun(runId) {
        this.canceledRuns.add(runId);
    }
    createStream(prompt, signal) {
        const runId = `run_${Date.now()}`;
        const encoder = new TextEncoder();
        const ctx = {
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
        return new ReadableStream({
            start: (controller) => {
                let closed = false;
                const closeIfNeeded = () => {
                    if (closed) {
                        return;
                    }
                    closed = true;
                    controller.close();
                };
                const sendEvent = (event) => {
                    if (closed) {
                        return;
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                };
                /**
                 * Single event gateway for state machine:
                 * 1) validate and apply transition
                 * 2) project internal state changes to SSE messages
                 */
                const dispatch = (event) => {
                    if (isTerminalState(ctx.state)) {
                        return;
                    }
                    applyEvent(ctx, event);
                    if (event.type === "TOKEN") {
                        sendEvent({
                            type: "chunk",
                            runId: ctx.runId,
                            index: ctx.chunkIndex,
                            content: event.text,
                        });
                        return;
                    }
                    if (event.type === "MODEL_DONE") {
                        sendEvent({ type: "done", runId: ctx.runId });
                        return;
                    }
                    if (event.type === "RETRIEVAL_ERR" ||
                        event.type === "TOOL_ERR" ||
                        event.type === "MODEL_ERR" ||
                        event.type === "CLIENT_CANCEL" ||
                        event.type === "TIMEOUT") {
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
                        dispatch({ type: "TIMEOUT" });
                    }
                }, this.maxRunMs);
                this.queue.enqueue(async () => {
                    try {
                        dispatch({ type: "START_RETRIEVAL" });
                        let hits = [];
                        try {
                            hits = await retrieveContext(ctx.prompt);
                        }
                        catch (err) {
                            const message = err instanceof Error
                                ? err.message
                                : "Retrieval failed";
                            dispatch({ type: "RETRIEVAL_ERR", error: message });
                            return;
                        }
                        if (this.canceledRuns.has(runId)) {
                            dispatch({ type: "CLIENT_CANCEL" });
                            return;
                        }
                        dispatch({ type: "RETRIEVAL_OK", hits });
                        dispatch({ type: "START_GENERATION" });
                        const toolResult = await runToolFromPrompt(ctx.prompt);
                        if (toolResult) {
                            dispatch({
                                type: "TOOL_CALL",
                                tool: "local.tool",
                                args: { prompt: ctx.prompt },
                            });
                            dispatch({ type: "TOOL_OK", result: toolResult });
                            dispatch({ type: "TOKEN", text: `[tool] ${toolResult}\n` });
                        }
                        for await (const token of streamModelTokens(ctx, hits, signal)) {
                            if (this.canceledRuns.has(runId)) {
                                dispatch({ type: "CLIENT_CANCEL" });
                                return;
                            }
                            dispatch({ type: "TOKEN", text: token });
                        }
                        dispatch({ type: "MODEL_DONE" });
                    }
                    catch (err) {
                        if (this.canceledRuns.has(runId) || isAbortError(err)) {
                            dispatch({ type: "CLIENT_CANCEL" });
                        }
                        else {
                            const message = err instanceof Error
                                ? err.message
                                : "Unknown stream error";
                            dispatch({ type: "MODEL_ERR", error: message });
                        }
                    }
                    finally {
                        this.canceledRuns.delete(runId);
                        clearInterval(heartbeat);
                        clearTimeout(timeout);
                        closeIfNeeded();
                    }
                });
                signal.addEventListener("abort", () => {
                    this.canceledRuns.add(runId);
                    if (!isTerminalState(ctx.state)) {
                        dispatch({ type: "CLIENT_CANCEL" });
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
