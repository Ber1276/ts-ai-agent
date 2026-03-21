export const ApiErrorCode = {
    INVALID_MESSAGE: "INVALID_MESSAGE",
    INTERNAL_ERROR: "INTERNAL_ERROR",
};
export const MessageRole = {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system'
};
export function createSuccessResponse(data) {
    return {
        success: true,
        data,
    };
}
export function createErrorResponse(code, message) {
    return {
        success: false,
        error: {
            code,
            message,
        },
    };
}
//# sourceMappingURL=index.js.map