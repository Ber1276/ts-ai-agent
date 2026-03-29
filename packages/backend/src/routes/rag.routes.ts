import { Hono } from "hono";
import { createRequire } from "module";
import type { RagConfigUpdateRequest } from "share";

const require = createRequire(import.meta.url);
const { PDFParse } = require("pdf-parse");
import { AppError } from "../core/errors/app-error.js";
import {
    getRagConfig,
    getRagStrategyInfo,
    ingestPlainTextDocument,
    listIndexedDocuments,
    updateRagConfig,
    testEmbeddingConnection,
    getOrCreateRagConfigRecord,
    ensureDefaultKnowledgeBaseId,
} from "../modules/rag/document-index.js";
import { createSuccessResponse } from "share";

function getMaxUploadBytes(): number {
    const parsed = Number(process.env.RAG_MAX_UPLOAD_BYTES ?? "10485760");
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 1024 * 1024;
}

export const ragRoutes = new Hono()
    .get("/config", async (c) => {
        const config = await getRagConfig();
        return c.json(createSuccessResponse({ config }));
    })
    .put("/config", async (c) => {
        const payload = (await c.req
            .json()
            .catch(() => null)) as RagConfigUpdateRequest | null;

        if (!payload?.config || typeof payload.config !== "object") {
            throw new AppError(
                400,
                "VALIDATION_ERROR",
                "config payload is required",
            );
        }

        const config = await updateRagConfig(payload.config);
        return c.json(createSuccessResponse({ config }));
    })
    .post("/test-embedding", async (c) => {
        const payload = (await c.req
            .json()
            .catch(() => null)) as RagConfigUpdateRequest | null;
        if (!payload?.config || typeof payload.config !== "object") {
             throw new AppError(400, "VALIDATION_ERROR", "config payload is required");
        }
        
        let apiKey = payload.config.embeddingApiKey ?? "";
        if (!apiKey) {
             const kbId = await ensureDefaultKnowledgeBaseId();
             const existing = await getOrCreateRagConfigRecord(kbId);
             apiKey = existing.embeddingApiKey ?? "";
        }
        
        if (!payload.config.embeddingModel || !payload.config.embeddingEndpoint || !apiKey) {
            throw new AppError(400, "VALIDATION_ERROR", "缺少必要的 Embedding 配置信息");
        }

        const dims = payload.config.embeddingDimensions ?? 1536;
        
        const testResult = await testEmbeddingConnection(
            payload.config.embeddingEndpoint,
            payload.config.embeddingModel,
            apiKey,
            dims
        );
        
        if (!testResult.ok) {
            throw new AppError(400, "VALIDATION_ERROR", testResult.message ?? "Embedding 连接失败");
        }

        return c.json(createSuccessResponse({ vectorSize: testResult.vectorSize }));
    })
    .get("/strategy", async (c) => {
        const strategy = await getRagStrategyInfo();
        const indexedDocuments = await listIndexedDocuments();
        const config = await getRagConfig();

        return c.json(
            createSuccessResponse({
                strategy,
                indexedDocuments,
                config,
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

            const fileName = String(file.name ?? "uploaded-document");
            const fileType = (file as unknown as File).type;
            const isPdf = fileType === "application/pdf" || fileName.toLowerCase().endsWith(".pdf");

            if (isPdf && typeof (file as unknown as File).arrayBuffer === "function") {
                const arrayBuffer = await (file as unknown as File).arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const parser = new PDFParse({ data: buffer });
                
                try {
                    const pdfData = await parser.getText();
                    content = pdfData.text;
                } finally {
                    await parser.destroy();
                }
                
                title = title || fileName;
            } else {
                content = await file.text();
                title = title || fileName;
            }
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
