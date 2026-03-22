export const ApiErrorCode = {
    VALIDATION_ERROR: "VALIDATION_ERROR",
    UNAUTHORIZED: "UNAUTHORIZED",
    NOT_FOUND: "NOT_FOUND",
    CONFLICT: "CONFLICT",
    RATE_LIMITED: "RATE_LIMITED",
    INTERNAL_ERROR: "INTERNAL_ERROR",
};
export const MessageRole = {
    USER: "user",
    ASSISTANT: "assistant",
    SYSTEM: "system",
};
export function createSuccessResponse(data) {
    return {
        success: true,
        data,
    };
}
export function createErrorResponse(code, message, details) {
    const error = details === undefined ? { code, message } : { code, message, details };
    return {
        success: false,
        error,
    };
}
//# sourceMappingURL=index.js.map