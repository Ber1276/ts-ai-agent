import { MessageRole } from "share";
import { AppError } from "../../core/errors/app-error.js";
export function parseChatRequest(payload) {
    if (!payload || typeof payload !== "object") {
        throw new AppError(400, "VALIDATION_ERROR", "Payload must be an object");
    }
    const maybeRequest = payload;
    const message = maybeRequest.message;
    if (!message) {
        throw new AppError(400, "VALIDATION_ERROR", "Missing message field");
    }
    validateMessage(message);
    return { message };
}
export function parseCancelRunId(payload) {
    if (!payload || typeof payload !== "object" || !("runId" in payload)) {
        throw new AppError(400, "VALIDATION_ERROR", "runId is required");
    }
    const runId = String(payload.runId);
    if (!runId.trim()) {
        throw new AppError(400, "VALIDATION_ERROR", "runId is required");
    }
    return runId;
}
function validateMessage(message) {
    if (!message.content || message.content.trim() === "") {
        throw new AppError(400, "VALIDATION_ERROR", "Message content cannot be empty");
    }
    if (!Object.values(MessageRole).includes(message.role)) {
        throw new AppError(400, "VALIDATION_ERROR", "Invalid message role", {
            role: message.role,
        });
    }
    if (!message.id || !message.timestamp) {
        throw new AppError(400, "VALIDATION_ERROR", "Message metadata is required");
    }
}
