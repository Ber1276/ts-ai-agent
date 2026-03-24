import { Hono } from "hono";
import { AppError } from "../core/errors/app-error.js";
import {
    getRagStrategyInfo,
    ingestPlainTextDocument,
    listIndexedDocuments,
} from "../modules/rag/document-index.js";
import { createSuccessResponse } from "share";

function getMaxUploadBytes(): number {
    const parsed = Number(process.env.RAG_MAX_UPLOAD_BYTES ?? "10485760");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 1024 * 1024;
}

export const ragRoutes = new Hono()
    .get("/strategy", async (c) => {
        const strategy = await getRagStrategyInfo();
        const indexedDocuments = await listIndexedDocuments();
        return c.json(
            createSuccessResponse({
                strategy,
                indexedDocuments,
            }),
        );
    })
    .post("/documents/upload", async (c) => {
        const maxUploadBytes = getMaxUploadBytes();
        const body = await c.req.parseBody();

        const providedContent = body.content;
        const providedTitle = body.title;

        let title = typeof providedTitle === "string" ? providedTitle : "";
        let content =
            typeof providedContent === "string" ? providedContent : "";

        const maybeFile = body.file;
        if (maybeFile && typeof maybeFile === "object") {
            const file = maybeFile as {
                name?: string;
                size?: number;
                text?: () => Promise<string>;
            };

            const fileSize = Number(file.size ?? 0);
            if (fileSize <= 0) {
                throw new AppError(
                    400,
                    "VALIDATION_ERROR",
                    "Uploaded file is empty",
                );
            }
            if (fileSize > maxUploadBytes) {
                throw new AppError(
                    400,
                    "VALIDATION_ERROR",
                    `File exceeds max size ${maxUploadBytes} bytes`,
                );
            }

            if (typeof file.text !== "function") {
                throw new AppError(
                    400,
                    "VALIDATION_ERROR",
                    "Unsupported upload file type",
                );
            }

            content = await file.text();
            title = title || String(file.name ?? "uploaded-document");
        }

        if (!content.trim()) {
            throw new AppError(
                400,
                "VALIDATION_ERROR",
                "content or file is required for document upload",
            );
        }

        if (!title.trim()) {
            title = `document-${Date.now()}`;
        }

        const ingested = await ingestPlainTextDocument({ title, content });
        return c.json(
            createSuccessResponse({
                ingested,
                maxUploadBytes,
            }),
        );
    });
