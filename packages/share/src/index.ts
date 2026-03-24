export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: ApiErrorCodeType;
        message: string;
        details?: Record<string, unknown>;
    };
}

export const ApiErrorCode = {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    UNAUTHORIZED: "UNAUTHORIZED",
    NOT_FOUND: "NOT_FOUND",
    CONFLICT: "CONFLICT",
    RATE_LIMITED: "RATE_LIMITED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ApiErrorCodeType = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];

export const MessageRole = {
    USER: "user",
    ASSISTANT: "assistant",
    SYSTEM: "system",
} as const;

export type MessageRoleType = (typeof MessageRole)[keyof typeof MessageRole];

export interface ChatMessage {
    id: string;
    role: MessageRoleType;
    content: string;
    timestamp: number;
}

export interface ChatRequest {
    message: ChatMessage;
}

export interface ChatResponse {
    response: string;
}

export interface StreamChunkEvent {
    type: "chunk";
    runId: string;
    index: number;
    content: string;
}

export interface StreamStartEvent {
    type: "run_start";
    runId: string;
    ts: number;
}

export interface StreamDoneEvent {
    type: "done";
    runId: string;
}

export interface StreamErrorEvent {
    type: "error";
    runId: string;
    message: string;
}

export interface StreamHeartbeatEvent {
    type: "heartbeat";
    runId: string;
    ts: number;
}

export type ChatStreamEvent =
    | StreamStartEvent
    | StreamChunkEvent
    | StreamDoneEvent
    | StreamErrorEvent
    | StreamHeartbeatEvent;

export function createSuccessResponse<T>(data: T): ApiResponse<T> {
    return {
        success: true,
        data,
    };
}

export function createErrorResponse(
    code: ApiErrorCodeType,
    message: string,
    details?: Record<string, unknown>,
): ApiResponse<never> {
    const error =
        details === undefined ? { code, message } : { code, message, details };

    return {
        success: false,
        error,
    };
}
