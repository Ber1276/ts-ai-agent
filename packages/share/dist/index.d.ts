export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}
export declare const ApiErrorCode: {
    readonly INVALID_MESSAGE: "INVALID_MESSAGE";
    readonly INTERNAL_ERROR: "INTERNAL_ERROR";
};
export type ApiErrorCodeType = typeof ApiErrorCode[keyof typeof ApiErrorCode];
export declare const MessageRole: {
    readonly USER: "user";
    readonly ASSISTANT: "assistant";
    readonly SYSTEM: "system";
};
export type MessageRoleType = typeof MessageRole[keyof typeof MessageRole];
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
export declare function createSuccessResponse<T>(data: T): ApiResponse<T>;
export declare function createErrorResponse(code: ApiErrorCodeType, message: string): ApiResponse<never>;
//# sourceMappingURL=index.d.ts.map