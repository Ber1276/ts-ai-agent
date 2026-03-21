export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

export const ApiErrorCode = {
    INVALID_MESSAGE: "INVALID_MESSAGE",
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

export function createSuccessResponse<T>(data: T): ApiResponse<T> {
    return {
        success: true,
        data,
    };
}

export function createErrorResponse(
    code: ApiErrorCodeType,
    message: string,
): ApiResponse<never> {
    return {
        success: false,
        error: {
            code,
            message,
        },
    };
}
