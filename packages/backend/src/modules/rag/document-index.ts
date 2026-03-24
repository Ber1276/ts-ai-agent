import { DocumentStatus } from "@prisma/client";
import { getPrismaClient } from "../../core/db/prisma-client.js";

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 120;

export interface IngestResult {
    documentId: string;
    title: string;
    chunkCount: number;
    charCount: number;
}

function sanitizeTitle(title: string): string {
    const trimmed = title.trim();
    return trimmed || `document-${Date.now()}`;
}

function splitTextIntoChunks(
    text: string,
    chunkSize = DEFAULT_CHUNK_SIZE,
    chunkOverlap = DEFAULT_CHUNK_OVERLAP,
): string[] {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
        return [];
    }

    const safeOverlap = Math.max(0, Math.min(chunkOverlap, chunkSize - 1));
    const step = chunkSize - safeOverlap;
    const output: string[] = [];

    for (let start = 0; start < normalized.length; start += step) {
        const end = Math.min(start + chunkSize, normalized.length);
        const chunk = normalized.slice(start, end).trim();
        if (chunk) {
            output.push(chunk);
        }
        if (end >= normalized.length) {
            break;
        }
    }

    return output;
}

async function ensureDefaultKnowledgeBaseId(): Promise<string> {
    const prisma = getPrismaClient();

    const userEmail = process.env.RAG_DEFAULT_USER_EMAIL ?? "dev@local.agent";
    const userName = process.env.RAG_DEFAULT_USER_NAME ?? "Dev User";
    const kbName = process.env.RAG_DEFAULT_KB_NAME ?? "Default Knowledge Base";

    const user = await prisma.user.upsert({
        where: { email: userEmail },
        update: { name: userName },
        create: { email: userEmail, name: userName },
    });

    const kb = await prisma.knowledgeBase.upsert({
        where: {
            id: `${user.id}-default-kb`,
        },
        update: {
            name: kbName,
        },
        create: {
            id: `${user.id}-default-kb`,
            name: kbName,
            userId: user.id,
            description: "Auto-created KB for RAG ingestion",
        },
    });

    return kb.id;
}

export async function ingestPlainTextDocument(input: {
    title: string;
    content: string;
}): Promise<IngestResult> {
    const prisma = getPrismaClient();
    const title = sanitizeTitle(input.title);
    const content = input.content.trim();
    const textChunks = splitTextIntoChunks(content);

    const knowledgeBaseId = await ensureDefaultKnowledgeBaseId();

    const document = await prisma.document.create({
        data: {
            title,
            content,
            status: DocumentStatus.INDEXED,
            knowledgeBaseId,
            chunks: {
                create: textChunks.map((chunk) => ({
                    content: chunk,
                })),
            },
        },
    });

    return {
        documentId: document.id,
        title,
        chunkCount: textChunks.length,
        charCount: content.length,
    };
}

export async function listIndexedDocuments(): Promise<
    Array<{ title: string; chunkCount: number }>
> {
    const prisma = getPrismaClient();
    const rows = await prisma.document.findMany({
        where: {
            status: DocumentStatus.INDEXED,
        },
        select: {
            title: true,
            _count: {
                select: {
                    chunks: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        take: 200,
    });

    return rows.map((row) => ({
        title: row.title,
        chunkCount: row._count.chunks,
    }));
}

export async function retrieveFromIndexedDocuments(
    prompt: string,
    limit = 4,
): Promise<string[]> {
    const tokens = prompt
        .toLowerCase()
        .split(/\W+/)
        .map((item) => item.trim())
        .filter((item) => item.length >= 3);

    if (tokens.length === 0) {
        return [];
    }

    const prisma = getPrismaClient();
    const candidates = await prisma.documentChunk.findMany({
        where: {
            document: {
                status: DocumentStatus.INDEXED,
            },
        },
        select: {
            content: true,
            createdAt: true,
            document: {
                select: {
                    title: true,
                },
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        take: 1000,
    });

    return candidates
        .map((chunk) => {
            const lowered = chunk.content.toLowerCase();
            const score = tokens.reduce(
                (acc, token) => acc + (lowered.includes(token) ? 1 : 0),
                0,
            );
            return {
                text: `[${chunk.document.title}] ${chunk.content}`,
                score,
                createdAt: chunk.createdAt.getTime(),
            };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || b.createdAt - a.createdAt)
        .slice(0, limit)
        .map((item) => item.text);
}

export async function getRagStrategyInfo(): Promise<{
    mode: "keyword" | "vector";
    shouldUseVectorDb: boolean;
    reason: string;
}> {
    const mode =
        (process.env.RAG_RETRIEVER_MODE ?? "keyword") === "vector"
            ? "vector"
            : "keyword";

    if (mode === "vector") {
        return {
            mode,
            shouldUseVectorDb: true,
            reason: "Vector mode requested. Connect pgvector/Milvus/Pinecone before production.",
        };
    }

    const prisma = getPrismaClient();
    const indexedChunkCount = await prisma.documentChunk.count({
        where: {
            document: {
                status: DocumentStatus.INDEXED,
            },
        },
    });

    if (indexedChunkCount >= 2000) {
        return {
            mode,
            shouldUseVectorDb: true,
            reason: "Keyword retrieval becomes noisy at high corpus size; migrate to vector retrieval.",
        };
    }

    return {
        mode,
        shouldUseVectorDb: false,
        reason: "Current corpus is small. Keyword retrieval is acceptable for scaffold stage.",
    };
}
