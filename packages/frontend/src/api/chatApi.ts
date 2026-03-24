import type { AppType } from "agent-server/app";
import {
    MessageRole,
    type ApiResponse,
    type ChatRequest,
    type ChatStreamRequest,
    type ChatStreamEvent,
    type ModelSelectionInput,
    type ModelServiceSaveInput,
    type ModelServiceItem,
    type ModelServiceTestResult,
} from "share";

export type BackendHonoContract = AppType;

function buildChatRequest(message: string): ChatRequest {
    return {
        message: {
            id: `msg-${Date.now()}`,
            role: MessageRole.USER,
            content: message,
            timestamp: Date.now(),
        },
    };
}

export const fetchChatResponse = async (message: string): Promise<string> => {
    const payload = buildChatRequest(message);

    const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
    }

    const response = (await res.json()) as ApiResponse<{ response: string }>;

    if (!response.success) {
        throw new Error(response.error?.message || "No response data received");
    }

    if (!("data" in response) || !response.data) {
        throw new Error("No response data received");
    }

    return response.data.response;
};

export const cancelChatStream = async (runId: string): Promise<void> => {
    const res = await fetch("/api/chat/stream/cancel", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ runId }),
    });

    if (!res.ok) {
        throw new Error(`Cancel stream failed with status ${res.status}`);
    }

    const response = (await res.json()) as ApiResponse<{ canceled: boolean }>;
    if (!response.success) {
        throw new Error(response.error?.message || "Cancel stream failed");
    }
};

export interface ChatStreamCallbacks {
    onRunStart?: (
        event: Extract<ChatStreamEvent, { type: "run_start" }>,
    ) => void;
    onChunk: (event: Extract<ChatStreamEvent, { type: "chunk" }>) => void;
    onDone: (event: Extract<ChatStreamEvent, { type: "done" }>) => void;
    onError: (message: string) => void;
    onHeartbeat?: (
        event: Extract<ChatStreamEvent, { type: "heartbeat" }>,
    ) => void;
}

export interface RagStrategyInfo {
    mode: "keyword" | "vector";
    shouldUseVectorDb: boolean;
    reason: string;
}

export interface IndexedDocumentInfo {
    title: string;
    chunkCount: number;
}

export interface RagStrategyResponse {
    strategy: RagStrategyInfo;
    indexedDocuments: IndexedDocumentInfo[];
}

export interface RagUploadResult {
    documentId: string;
    title: string;
    chunkCount: number;
    charCount: number;
}

export async function fetchModelServices(): Promise<ModelServiceItem[]> {
    const res = await fetch("/api/model-services");
    if (!res.ok) {
        throw new Error(`Load model services failed with status ${res.status}`);
    }

    const response = (await res.json()) as ApiResponse<{
        services: ModelServiceItem[];
    }>;

    if (!response.success || !response.data) {
        throw new Error(
            response.error?.message || "Load model services failed",
        );
    }

    return response.data.services;
}

export async function testModelService(
    modelSelection: ModelSelectionInput,
): Promise<ModelServiceTestResult> {
    const res = await fetch("/api/model-services/test", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ modelSelection }),
    });

    if (!res.ok) {
        throw new Error(`Test model service failed with status ${res.status}`);
    }

    const response = (await res.json()) as ApiResponse<{
        result: ModelServiceTestResult;
    }>;

    if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Model service test failed");
    }

    return response.data.result;
}

export async function saveModelService(
    service: ModelServiceSaveInput,
): Promise<{ saved: ModelServiceItem; services: ModelServiceItem[] }> {
    const res = await fetch("/api/model-services", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ service }),
    });

    if (!res.ok) {
        throw new Error(`Save model service failed with status ${res.status}`);
    }

    const response = (await res.json()) as ApiResponse<{
        saved: ModelServiceItem;
        services: ModelServiceItem[];
    }>;

    if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Save model service failed");
    }

    return response.data;
}

export async function updateModelService(
    id: string,
    service: ModelServiceSaveInput,
): Promise<{ saved: ModelServiceItem; services: ModelServiceItem[] }> {
    const res = await fetch(`/api/model-services/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ service }),
    });

    if (!res.ok) {
        throw new Error(
            `Update model service failed with status ${res.status}`,
        );
    }

    const response = (await res.json()) as ApiResponse<{
        saved: ModelServiceItem;
        services: ModelServiceItem[];
    }>;

    if (!response.success || !response.data) {
        throw new Error(
            response.error?.message || "Update model service failed",
        );
    }

    return response.data;
}

export async function deleteModelService(
    id: string,
): Promise<{ id: string; services: ModelServiceItem[] }> {
    const res = await fetch(`/api/model-services/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });

    if (!res.ok) {
        throw new Error(
            `Delete model service failed with status ${res.status}`,
        );
    }

    const response = (await res.json()) as ApiResponse<{
        id: string;
        services: ModelServiceItem[];
    }>;

    if (!response.success || !response.data) {
        throw new Error(
            response.error?.message || "Delete model service failed",
        );
    }

    return response.data;
}

export async function fetchRagStrategy(): Promise<RagStrategyResponse> {
    const res = await fetch("/api/rag/strategy");
    if (!res.ok) {
        throw new Error(`Load RAG strategy failed with status ${res.status}`);
    }

    const response = (await res.json()) as ApiResponse<RagStrategyResponse>;
    if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Load RAG strategy failed");
    }

    return response.data;
}

export async function uploadRagDocument(input: {
    title?: string;
    content?: string;
    file?: File;
}): Promise<{ ingested: RagUploadResult; maxUploadBytes: number }> {
    const form = new FormData();
    if (input.title) {
        form.append("title", input.title);
    }
    if (input.content) {
        form.append("content", input.content);
    }
    if (input.file) {
        form.append("file", input.file);
    }

    const res = await fetch("/api/rag/documents/upload", {
        method: "POST",
        body: form,
    });

    if (!res.ok) {
        throw new Error(`Upload document failed with status ${res.status}`);
    }

    const response = (await res.json()) as ApiResponse<{
        ingested: RagUploadResult;
        maxUploadBytes: number;
    }>;

    if (!response.success || !response.data) {
        throw new Error(response.error?.message || "Upload document failed");
    }

    return response.data;
}

async function* parseSseEvents(
    body: ReadableStream<Uint8Array>,
): AsyncGenerator<ChatStreamEvent> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });

            while (true) {
                const delimiter = buffer.indexOf("\n\n");
                if (delimiter === -1) {
                    break;
                }

                const rawEvent = buffer.slice(0, delimiter);
                buffer = buffer.slice(delimiter + 2);

                const data = rawEvent
                    .split("\n")
                    .filter((line) => line.startsWith("data:"))
                    .map((line) => line.slice(5).trim())
                    .join("\n");

                if (!data) {
                    continue;
                }

                yield JSON.parse(data) as ChatStreamEvent;
            }
        }
    } finally {
        reader.releaseLock();
    }
}

export const startChatStream = (
    prompt: string,
    modelSelection: ModelSelectionInput | undefined,
    callbacks: ChatStreamCallbacks,
): (() => void) => {
    const controller = new AbortController();

    const payload: ChatStreamRequest = {
        prompt,
        modelSelection,
    };

    void (async () => {
        try {
            const res = await fetch("/api/chat/stream", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            if (!res.ok || !res.body) {
                callbacks.onError(
                    `Streaming request failed with status ${res.status}`,
                );
                return;
            }

            for await (const parsed of parseSseEvents(res.body)) {
                if (parsed.type === "run_start") {
                    callbacks.onRunStart?.(parsed);
                    continue;
                }

                if (parsed.type === "chunk") {
                    callbacks.onChunk(parsed);
                    continue;
                }

                if (parsed.type === "done") {
                    callbacks.onDone(parsed);
                    return;
                }

                if (parsed.type === "heartbeat") {
                    callbacks.onHeartbeat?.(parsed);
                    continue;
                }

                if (parsed.type === "error") {
                    callbacks.onError(parsed.message);
                    return;
                }

                callbacks.onError("Unknown stream event");
                return;
            }
        } catch (err) {
            if (controller.signal.aborted) {
                return;
            }

            const message =
                err instanceof Error
                    ? err.message
                    : "Streaming connection failed";
            callbacks.onError(message);
        }
    })();

    return () => {
        controller.abort();
    };
};
