import type { Hono } from "hono";
import { ApiErrorCode, createErrorResponse, type ApiResponse } from "share";
import { AppError } from "../errors/app-error.js";

export function registerErrorHandlers(app: Hono): void {
    app.onError((err, c) => {
        if (err instanceof AppError) {
            return c.json(
                createErrorResponse(
                    err.code,
                    err.message,
                    err.details,
                ) as ApiResponse<never>,
                err.status,
            );
        }

        console.error("Unhandled error:", err);
        return c.json(
            createErrorResponse(
                ApiErrorCode.INTERNAL_ERROR,
                "Unexpected server error",
            ) as ApiResponse<never>,
            500,
        );
    });

    app.notFound((c) => {
        return c.json(
            createErrorResponse(
                ApiErrorCode.NOT_FOUND,
                "Route not found",
            ) as ApiResponse<never>,
            404,
        );
    });
}
