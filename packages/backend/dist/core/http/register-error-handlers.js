import { ApiErrorCode, createErrorResponse } from "share";
import { AppError } from "../errors/app-error.js";
export function registerErrorHandlers(app) {
    app.onError((err, c) => {
        if (err instanceof AppError) {
            return c.json(createErrorResponse(err.code, err.message, err.details), err.status);
        }
        console.error("Unhandled error:", err);
        return c.json(createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "Unexpected server error"), 500);
    });
    app.notFound((c) => {
        return c.json(createErrorResponse(ApiErrorCode.NOT_FOUND, "Route not found"), 404);
    });
}
