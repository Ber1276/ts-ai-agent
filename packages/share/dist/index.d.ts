export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: ApiErrorCodeType;
        message: string;
        details?: Record<string, unknown>;
    };
}
export declare const ApiErrorCode: {
    readonly VALIDATION_ERROR: "VALIDATION_ERROR";
    readonly UNAUTHORIZED: "UNAUTHORIZED";
    readonly NOT_FOUND: "NOT_FOUND";
    readonly CONFLICT: "CONFLICT";
    readonly RATE_LIMITED: "RATE_LIMITED";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
export type ApiErrorCodeType = (typeof ApiErrorCode)[keyof typeof ApiErrorCode];
export declare const MessageRole: {
    readonly USER: "user";
    readonly ASSISTANT: "assistant";
    readonly SYSTEM: "system";
};
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
export type ChatStreamEvent = StreamChunkEvent | StreamDoneEvent | StreamErrorEvent | StreamHeartbeatEvent;
export declare function createSuccessResponse<T>(data: T): ApiResponse<T>;
export declare function createErrorResponse(code: ApiErrorCodeType, message: string, details?: Record<string, unknown>): ApiResponse<never>;
//# sourceMappingURL=index.d.ts.map