import { useCallback, useMemo, useRef, useState } from "react";
import {
    cancelChatStream,
    fetchChatResponse,
    startChatStream,
} from "../api/chatApi";
import type { UIMessage } from "../types/chat";

function createMessage(
    role: UIMessage["role"],
    content: string,
    prefix: string,
): UIMessage {
    return {
        id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
    };
}

export function useChat() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const stopStreamRef = useRef<(() => void) | null>(null);

    const canSend = useMemo(
        () => !loading && !streaming && input.trim().length > 0,
        [input, loading, streaming],
    );

    const appendMessage = useCallback((message: UIMessage) => {
        setMessages((prev) => [...prev, message]);
    }, []);

    const sendOnce = useCallback(async () => {
        if (!input.trim()) {
            return;
        }

        const currentInput = input.trim();
        appendMessage(createMessage("user", currentInput, "u"));
        setInput("");
        setLoading(true);
        setError(null);

        try {
            const response = await fetchChatResponse(currentInput);
            appendMessage(createMessage("assistant", response, "a"));
        } catch (err) {
            const errorMsg =
                err instanceof Error ? err.message : "Failed to fetch response";
            setError(errorMsg);
            appendMessage(
                createMessage("assistant", `Error: ${errorMsg}`, "a-err"),
            );
        } finally {
            setLoading(false);
        }
    }, [appendMessage, input]);

    const sendStream = useCallback(() => {
        if (!input.trim() || streaming) {
            return;
        }

        const currentInput = input.trim();
        appendMessage(createMessage("user", currentInput, "u"));
        setInput("");
        setStreaming(true);
        setError(null);
        setLastHeartbeatAt(null);

        const assistantMessageId = `a-stream-${Date.now()}`;
        appendMessage({
            id: assistantMessageId,
            role: "assistant",
            content: "",
        });

        stopStreamRef.current = startChatStream(currentInput, {
            onRunStart: (event) => {
                setActiveRunId(event.runId);
            },
            onChunk: (event) => {
                setActiveRunId((prev) => prev ?? event.runId);
                setMessages((prev) =>
                    prev.map((item) =>
                        item.id === assistantMessageId
                            ? {
                                  ...item,
                                  content: `${item.content}${event.content}\n`,
                              }
                            : item,
                    ),
                );
            },
            onDone: () => {
                setStreaming(false);
                setActiveRunId(null);
            },
            onError: (message) => {
                setError(message);
                setStreaming(false);
                setActiveRunId(null);
            },
            onHeartbeat: (event) => {
                setLastHeartbeatAt(event.ts);
            },
        });

        // TODO(handwrite): add reconnect strategy with exponential backoff.
        // Required: persist last received chunk index and support resume after reconnect.
    }, [appendMessage, input, streaming]);

    const stopStream = useCallback(async () => {
        if (stopStreamRef.current) {
            stopStreamRef.current();
            stopStreamRef.current = null;
        }

        if (activeRunId) {
            try {
                await cancelChatStream(activeRunId);
            } catch (err) {
                const errorMsg =
                    err instanceof Error
                        ? err.message
                        : "Failed to cancel stream";
                setError(errorMsg);
            }
        }

        setStreaming(false);
        setActiveRunId(null);
    }, [activeRunId]);

    return {
        input,
        setInput,
        messages,
        loading,
        streaming,
        error,
        lastHeartbeatAt,
        canSend,
        sendOnce,
        sendStream,
        stopStream,
    };
}
