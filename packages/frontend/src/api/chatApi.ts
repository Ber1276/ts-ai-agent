import type { AppType } from "agent-server/app";
import {
    MessageRole,
    type ApiResponse,
    type ChatRequest,
    type ChatStreamEvent,
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
    onChunk: (event: Extract<ChatStreamEvent, { type: "chunk" }>) => void;
    onDone: (event: Extract<ChatStreamEvent, { type: "done" }>) => void;
    onError: (message: string) => void;
    onHeartbeat?: (
        event: Extract<ChatStreamEvent, { type: "heartbeat" }>,
    ) => void;
}

export const startChatStream = (
    prompt: string,
    callbacks: ChatStreamCallbacks,
): (() => void) => {
    const query = new URLSearchParams({ prompt }).toString();
    const source = new EventSource(`/api/chat/stream?${query}`);

    source.onmessage = (event) => {
        try {
            const parsed = JSON.parse(event.data) as ChatStreamEvent;

            if (parsed.type === "chunk") {
                callbacks.onChunk(parsed);
                return;
            }

            if (parsed.type === "done") {
                callbacks.onDone(parsed);
                source.close();
                return;
            }

            if (parsed.type === "heartbeat") {
                callbacks.onHeartbeat?.(parsed);
                return;
            }

            if (parsed.type === "error") {
                callbacks.onError(parsed.message);
                source.close();
                return;
            }

            callbacks.onError("Unknown stream event");
            source.close();
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to parse stream event";
            callbacks.onError(message);
            source.close();
        }
    };

    source.onerror = () => {
        callbacks.onError("Streaming connection failed");
        source.close();
    };

    return () => {
        source.close();
    };
};
