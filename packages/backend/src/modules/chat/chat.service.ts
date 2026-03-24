import type { ChatRequest, ChatResponse } from "share";
import { resolveModelSelection } from "../model/model-service.js";
import { AppError } from "../../core/errors/app-error.js";
import {
    logUpstreamHttpError,
    logUpstreamNetworkError,
    readUpstreamError,
} from "../model/upstream-error.js";

export async function generateChatResponse(
    req: ChatRequest,
): Promise<ChatResponse> {
    const modelConfig = await resolveModelSelection(undefined);
    if (!modelConfig) {
        throw new AppError(
            400,
            "VALIDATION_ERROR",
            "No default model config found. Save a default model service first.",
        );
    }

    let response: Response;
    try {
        response = await fetch(modelConfig.endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${modelConfig.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: modelConfig.model,
                stream: false,
                messages: [{ role: "user", content: req.message.content }],
            }),
        });
    } catch (err) {
        logUpstreamNetworkError(
            {
                scope: "chat-once",
                endpoint: modelConfig.endpoint,
                model: modelConfig.model,
                source: modelConfig.source,
            },
            err,
        );

        throw new AppError(
            500,
            "INTERNAL_ERROR",
            err instanceof Error
                ? `Model request failed: ${err.message}`
                : "Model request failed",
        );
    }

    if (!response.ok) {
        const errorText = await readUpstreamError(response);
        logUpstreamHttpError(
            {
                scope: "chat-once",
                endpoint: modelConfig.endpoint,
                model: modelConfig.model,
                source: modelConfig.source,
            },
            errorText,
        );

        throw new AppError(500, "INTERNAL_ERROR", errorText);
    }

    const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
    };

    return {
        response:
            body.choices?.[0]?.message?.content?.trim() ||
            "Model returned empty response",
    };
}
