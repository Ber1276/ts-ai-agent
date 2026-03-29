import {
    DocumentStatus,
    RagRetrieverMode as PrismaRagRetrieverMode,
    RagVectorStore as PrismaRagVectorStore,
    type RagConfig as PrismaRagConfig,
} from "@prisma/client";
import type {
    RagConfigInfo,
    RagConfigUpdateInput,
    RagRetrieverMode,
    RagVectorStore,
} from "share";
import { AppError } from "../../core/errors/app-error.js";
import { getPrismaClient } from "../../core/db/prisma-client.js";
import {
    ensurePgVectorReady,
    isPgVectorExtensionInstalled,
    searchPgVectorChunkIds,
    upsertPgVectorChunk,
} from "./vector-store.pgvector.js";

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 120;
const DEFAULT_TOP_K = 6;
const DEFAULT_MIN_SCORE = 0.2;
const DEFAULT_EMBEDDING_DIMS = 1536;

const EMBEDDING_TIMEOUT_MS = 30000;

type RetrievalMode = RagRetrieverMode;
type VectorStore = RagVectorStore;

interface EmbeddingRuntimeConfig {
    endpoint: string;
    model: string;
    apiKey: string;
    dimensions: number;
    provider: string;
}

interface KeywordCandidate {
    chunkId: string;
    text: string;
    keywordScore: number;
    createdAt: number;
}

interface VectorCandidate {
    chunkId: string;
    text: string;
    vectorScore: number;
    createdAt: number;
}

interface MemoryVectorItem {
    chunkId: string;
    knowledgeBaseId: string;
    text: string;
    vector: number[];
    createdAt: number;
}

export interface IngestResult {
    documentId: string;
    title: string;
    chunkCount: number;
    charCount: number;
    embeddedChunkCount: number;
}

export interface RetrievalHit {
    documentId: string;
    documentTitle: string;
    content: string;
    text: string;
    score?: number;
}

const memoryVectorStore = new Map<string, Map<string, MemoryVectorItem>>();

function trimOrEmpty(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function clampInteger(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, Math.floor(value)));
}

function clampFloat(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function parseMode(value: unknown): RetrievalMode | null {
    const raw = trimOrEmpty(value).toLowerCase();
    if (raw === "keyword" || raw === "vector" || raw === "hybrid") {
        return raw;
    }
    return null;
}

function parseVectorStore(value: unknown): VectorStore | null {
    const raw = trimOrEmpty(value).toLowerCase();
    if (raw === "database" || raw === "memory" || raw === "pgvector") {
        return raw;
    }
    return null;
}

function modeToPrisma(mode: RetrievalMode): PrismaRagRetrieverMode {
    switch (mode) {
        case "keyword":
            return PrismaRagRetrieverMode.KEYWORD;
        case "vector":
            return PrismaRagRetrieverMode.VECTOR;
        case "hybrid":
            return PrismaRagRetrieverMode.HYBRID;
    }
}

function modeFromPrisma(mode: PrismaRagRetrieverMode): RetrievalMode {
    switch (mode) {
        case PrismaRagRetrieverMode.KEYWORD:
            return "keyword";
        case PrismaRagRetrieverMode.VECTOR:
            return "vector";
        case PrismaRagRetrieverMode.HYBRID:
            return "hybrid";
    }
}

function vectorStoreToPrisma(store: VectorStore): PrismaRagVectorStore {
    if (store === "memory") {
        return PrismaRagVectorStore.MEMORY;
    }

    if (store === "pgvector") {
        return PrismaRagVectorStore.PGVECTOR;
    }

    return PrismaRagVectorStore.DATABASE;
}

function vectorStoreFromPrisma(store: PrismaRagVectorStore): VectorStore {
    if (store === PrismaRagVectorStore.MEMORY) {
        return "memory";
    }

    if (store === PrismaRagVectorStore.PGVECTOR) {
        return "pgvector";
    }

    return "database";
}

function sanitizeTitle(title: string): string {
    const trimmed = title.trim();
    return trimmed || `document-${Date.now()}`;
}

function parseEnvNumber(name: string, fallback: number): number {
    const raw = Number(process.env[name]);
    if (!Number.isFinite(raw)) {
        return fallback;
    }
    return raw;
}

function getDefaultModeFromEnv(): RetrievalMode {
    const parsed = parseMode(process.env.RAG_RETRIEVER_MODE);
    return parsed ?? "keyword";
}

function getDefaultVectorStoreFromEnv(): VectorStore {
    const parsed = parseVectorStore(process.env.RAG_VECTOR_STORE);
    return parsed ?? "database";
}

function validateHttpUrl(input: string, field: string): string {
    let url: URL;
    try {
        url = new URL(input);
    } catch {
        throw new AppError(
            400,
            "VALIDATION_ERROR",
            `${field} must be a valid URL`,
        );
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new AppError(
            400,
            "VALIDATION_ERROR",
            `${field} must be a http(s) URL`,
        );
    }

    return url.toString();
}

function normalizeEmbeddingEndpoint(endpoint: string): string {
    const url = new URL(endpoint);
    const pathname = url.pathname.replace(/\/+$/, "");

    if (pathname.endsWith("/embeddings")) {
        return url.toString();
    }

    if (pathname.endsWith("/chat/completions")) {
        url.pathname = pathname.replace(/\/chat\/completions$/, "/embeddings");
        return url.toString();
    }

    if (pathname === "/v1" || pathname === "/compatible-mode/v1") {
        url.pathname = `${pathname}/embeddings`;
        return url.toString();
    }

    return url.toString();
}

function splitTextIntoChunks(
    text: string,
    chunkSize: number,
    chunkOverlap: number,
): string[] {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
        return [];
    }

    const safeChunkSize = clampInteger(chunkSize, 200, 8000);
    const safeOverlap = clampInteger(chunkOverlap, 0, safeChunkSize - 1);
    const step = safeChunkSize - safeOverlap;

    const output: string[] = [];
    for (let start = 0; start < normalized.length; start += step) {
        const end = Math.min(start + safeChunkSize, normalized.length);
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

function extractSearchTerms(input: string): string[] {
    const lowered = input.toLowerCase();
    const alphaNum = lowered
        .split(/[^\p{L}\p{N}_-]+/u)
        .map((item) => item.trim())
        .filter((item) => item.length >= 2);

    const compactCjk = lowered.replace(/\s+/g, "");
    const cjkChars = [...compactCjk].filter((char) => /\p{Script=Han}/u.test(char));
    const cjkBiGrams: string[] = [];
    for (let i = 0; i < cjkChars.length - 1 && cjkBiGrams.length < 40; i += 1) {
        cjkBiGrams.push(`${cjkChars[i]}${cjkChars[i + 1]}`);
    }

    return Array.from(new Set([...alphaNum, ...cjkBiGrams]));
}

function parseVectorJson(value: unknown): number[] | null {
    if (!Array.isArray(value)) {
        return null;
    }
    const nums = value.filter((item) => typeof item === "number") as number[];
    if (nums.length !== value.length || nums.length === 0) {
        return null;
    }
    if (!nums.every((item) => Number.isFinite(item))) {
        return null;
    }
    return nums;
}

function cosineSimilarity(a: number[], b: number[]): number {
    const size = Math.min(a.length, b.length);
    if (size === 0) {
        return 0;
    }

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < size; i += 1) {
        const av = a[i] ?? 0;
        const bv = b[i] ?? 0;
        dot += av * bv;
        magA += av * av;
        magB += bv * bv;
    }

    if (magA === 0 || magB === 0) {
        return 0;
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

function toPublicRagConfig(config: PrismaRagConfig): RagConfigInfo {
    return {
        retrieverMode: modeFromPrisma(config.retrieverMode),
        vectorStore: vectorStoreFromPrisma(config.vectorStore),
        chunkSize: config.chunkSize,
        chunkOverlap: config.chunkOverlap,
        topK: config.topK,
        minScore: config.minScore,
        embeddingEndpoint: config.embeddingEndpoint ?? "",
        embeddingModel: config.embeddingModel ?? "",
        embeddingApiKeySet:
            !!trimOrEmpty(config.embeddingApiKey) ||
            !!trimOrEmpty(process.env.RAG_EMBEDDING_API_KEY),
        embeddingDimensions: config.embeddingDimensions ?? DEFAULT_EMBEDDING_DIMS,
    };
}

function resolveEmbeddingRuntimeConfig(
    config: PrismaRagConfig,
): EmbeddingRuntimeConfig | null {
    const rawEndpoint =
        trimOrEmpty(config.embeddingEndpoint) ||
        trimOrEmpty(process.env.RAG_EMBEDDING_ENDPOINT);
    const rawModel =
        trimOrEmpty(config.embeddingModel) || trimOrEmpty(process.env.RAG_EMBEDDING_MODEL);
    const rawApiKey =
        trimOrEmpty(config.embeddingApiKey) ||
        trimOrEmpty(process.env.RAG_EMBEDDING_API_KEY);

    if (!rawEndpoint || !rawModel || !rawApiKey) {
        return null;
    }

    const endpoint = normalizeEmbeddingEndpoint(validateHttpUrl(rawEndpoint, "embeddingEndpoint"));
    const dimensions = clampInteger(
        config.embeddingDimensions ??
            parseEnvNumber("RAG_EMBEDDING_DIMENSIONS", DEFAULT_EMBEDDING_DIMS),
        64,
        8192,
    );

    return {
        endpoint,
        model: rawModel,
        apiKey: rawApiKey,
        dimensions,
        provider: new URL(endpoint).hostname,
    };
}

export async function ensureDefaultKnowledgeBaseId(): Promise<string> {
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

export async function getOrCreateRagConfigRecord(
    knowledgeBaseId: string,
): Promise<PrismaRagConfig> {
    const prisma = getPrismaClient();

    const existing = await prisma.ragConfig.findUnique({
        where: { knowledgeBaseId },
    });
    if (existing) {
        return existing;
    }

    return prisma.ragConfig.create({
        data: {
            knowledgeBaseId,
            retrieverMode: modeToPrisma(getDefaultModeFromEnv()),
            vectorStore: vectorStoreToPrisma(getDefaultVectorStoreFromEnv()),
            chunkSize: clampInteger(
                parseEnvNumber("RAG_CHUNK_SIZE", DEFAULT_CHUNK_SIZE),
                200,
                8000,
            ),
            chunkOverlap: clampInteger(
                parseEnvNumber("RAG_CHUNK_OVERLAP", DEFAULT_CHUNK_OVERLAP),
                0,
                2000,
            ),
            topK: clampInteger(parseEnvNumber("RAG_TOP_K", DEFAULT_TOP_K), 1, 20),
            minScore: clampFloat(
                parseEnvNumber("RAG_MIN_SCORE", DEFAULT_MIN_SCORE),
                0,
                1,
            ),
            embeddingEndpoint: trimOrEmpty(process.env.RAG_EMBEDDING_ENDPOINT) || null,
            embeddingModel: trimOrEmpty(process.env.RAG_EMBEDDING_MODEL) || null,
            embeddingApiKey: trimOrEmpty(process.env.RAG_EMBEDDING_API_KEY) || null,
            embeddingDimensions: clampInteger(
                parseEnvNumber("RAG_EMBEDDING_DIMENSIONS", DEFAULT_EMBEDDING_DIMS),
                64,
                8192,
            ),
        },
    });
}

function withTimeout(signal: AbortSignal, timeoutMs: number): AbortSignal {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    signal.addEventListener("abort", () => controller.abort(), { once: true });
    controller.signal.addEventListener(
        "abort",
        () => clearTimeout(timeout),
        { once: true },
    );

    return controller.signal;
}

async function createEmbedding(
    input: string,
    config: EmbeddingRuntimeConfig,
): Promise<number[]> {
    const controller = new AbortController();
    const signal = withTimeout(controller.signal, EMBEDDING_TIMEOUT_MS);
    const safeInput = input.slice(0, 20000);

    const isMultimodal = config.endpoint.includes("/multimodal");
    const payloadInput = isMultimodal ? [{ type: "text", text: safeInput }] : safeInput;

    const reqBody: Record<string, unknown> = {
        model: config.model,
        input: payloadInput,
    };

    // Many providers don't support the 'dimensions' parameter and will throw 400 Bad Request if it's present.
    // OpenAI supports it for text-embedding-3 models, but Volcengine multimodal explicitly rejects it.
    if (!config.endpoint.includes("volces.com")) {
         reqBody.dimensions = config.dimensions;
    }

    const response = await fetch(config.endpoint, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify(reqBody),
        signal,
    });

    if (!response.ok) {
        const message = await response.text().catch(() => "Embedding request failed");
        throw new Error(`Embedding request failed: ${message}`);
    }

    const payload = (await response.json()) as any;

    let vector: number[] | undefined;
    if (Array.isArray(payload?.data)) {
        vector = payload.data[0]?.embedding;
    } else if (payload?.data && Array.isArray(payload.data.embedding)) {
        vector = payload.data.embedding;
    }

    if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error("Embedding response missing vector data");
    }

    if (!vector.every((item) => typeof item === "number" && Number.isFinite(item))) {
        throw new Error("Embedding vector contains invalid numbers");
    }

    return vector;
}

async function hydrateMemoryStore(knowledgeBaseId: string): Promise<void> {
    const prisma = getPrismaClient();
    const rows = await prisma.documentChunkEmbedding.findMany({
        where: {
            chunk: {
                document: {
                    knowledgeBaseId,
                    status: DocumentStatus.INDEXED,
                },
            },
        },
        select: {
            chunkId: true,
            vector: true,
            chunk: {
                select: {
                    content: true,
                    createdAt: true,
                    document: {
                        select: { title: true },
                    },
                },
            },
        },
        take: 100000,
    });

    const index = new Map<string, MemoryVectorItem>();
    for (const row of rows) {
        const vector = parseVectorJson(row.vector);
        if (!vector) {
            continue;
        }

        index.set(row.chunkId, {
            chunkId: row.chunkId,
            knowledgeBaseId,
            text: `[${row.chunk.document.title}] ${row.chunk.content}`,
            vector,
            createdAt: row.chunk.createdAt.getTime(),
        });
    }

    memoryVectorStore.set(knowledgeBaseId, index);
}

async function ensureMemoryStore(knowledgeBaseId: string): Promise<Map<string, MemoryVectorItem>> {
    const existing = memoryVectorStore.get(knowledgeBaseId);
    if (existing && existing.size > 0) {
        return existing;
    }

    await hydrateMemoryStore(knowledgeBaseId);
    return memoryVectorStore.get(knowledgeBaseId) ?? new Map<string, MemoryVectorItem>();
}

async function syncPgVectorStoreFromEmbeddings(
    knowledgeBaseId: string,
): Promise<number> {
    await ensurePgVectorReady();

    const prisma = getPrismaClient();
    const rows = await prisma.documentChunkEmbedding.findMany({
        where: {
            chunk: {
                document: {
                    knowledgeBaseId,
                    status: DocumentStatus.INDEXED,
                },
            },
        },
        select: {
            chunkId: true,
            vector: true,
        },
        take: 100000,
    });

    let syncedCount = 0;
    for (const row of rows) {
        const vector = parseVectorJson(row.vector);
        if (!vector) {
            continue;
        }

        await upsertPgVectorChunk({
            chunkId: row.chunkId,
            knowledgeBaseId,
            embedding: vector,
        });
        syncedCount += 1;
    }

    return syncedCount;
}

async function embedDocumentChunks(
    knowledgeBaseId: string,
    documentTitle: string,
    chunks: Array<{ id: string; content: string; createdAt: Date }>,
    ragConfig: PrismaRagConfig,
): Promise<number> {
    const runtime = resolveEmbeddingRuntimeConfig(ragConfig);
    if (!runtime || chunks.length === 0) {
        return 0;
    }

    const prisma = getPrismaClient();
    let embeddedCount = 0;

    for (const chunk of chunks) {
        try {
            const vector = await createEmbedding(chunk.content, runtime);
            await prisma.documentChunkEmbedding.upsert({
                where: { chunkId: chunk.id },
                update: {
                    vector,
                    dimensions: vector.length,
                    provider: runtime.provider,
                    model: runtime.model,
                },
                create: {
                    chunkId: chunk.id,
                    vector,
                    dimensions: vector.length,
                    provider: runtime.provider,
                    model: runtime.model,
                },
            });

            const configuredStore = vectorStoreFromPrisma(ragConfig.vectorStore);

            if (configuredStore === "memory") {
                const map = memoryVectorStore.get(knowledgeBaseId) ?? new Map<string, MemoryVectorItem>();
                map.set(chunk.id, {
                    chunkId: chunk.id,
                    knowledgeBaseId,
                    text: `[${documentTitle}] ${chunk.content}`,
                    vector,
                    createdAt: chunk.createdAt.getTime(),
                });
                memoryVectorStore.set(knowledgeBaseId, map);
            }

            if (configuredStore === "pgvector") {
                await upsertPgVectorChunk({
                    chunkId: chunk.id,
                    knowledgeBaseId,
                    embedding: vector,
                });
            }

            embeddedCount += 1;
        } catch {
            // Keep ingestion resilient: one chunk embedding failure should not fail entire upload.
            continue;
        }
    }

    return embeddedCount;
}

async function retrieveKeywordCandidates(
    knowledgeBaseId: string,
    prompt: string,
): Promise<KeywordCandidate[]> {
    const tokens = extractSearchTerms(prompt);
    if (tokens.length === 0) {
        return [];
    }

    const prisma = getPrismaClient();
    const candidates = await prisma.documentChunk.findMany({
        where: {
            document: {
                knowledgeBaseId,
                status: DocumentStatus.INDEXED,
            },
        },
        select: {
            id: true,
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
        take: 10000,
    });

    return candidates
        .map((chunk) => {
            const lowered = chunk.content.toLowerCase();
            const score = tokens.reduce(
                (acc, token) => acc + (lowered.includes(token) ? 1 : 0),
                0,
            );

            return {
                chunkId: chunk.id,
                text: `[${chunk.document.title}] ${chunk.content}`,
                keywordScore: score,
                createdAt: chunk.createdAt.getTime(),
            };
        })
        .filter((item) => item.keywordScore > 0);
}

async function retrieveVectorCandidates(
    knowledgeBaseId: string,
    prompt: string,
    ragConfig: PrismaRagConfig,
): Promise<VectorCandidate[]> {
    const runtime = resolveEmbeddingRuntimeConfig(ragConfig);
    if (!runtime) {
        return [];
    }

    const queryVector = await createEmbedding(prompt, runtime);
    const minScore = clampFloat(ragConfig.minScore, 0, 1);
    const store = vectorStoreFromPrisma(ragConfig.vectorStore);

    if (store === "memory") {
        const index = await ensureMemoryStore(knowledgeBaseId);
        const output: VectorCandidate[] = [];

        for (const row of index.values()) {
            const score = cosineSimilarity(queryVector, row.vector);
            if (score < minScore) {
                continue;
            }
            output.push({
                chunkId: row.chunkId,
                text: row.text,
                vectorScore: score,
                createdAt: row.createdAt,
            });
        }

        return output;
    }

    if (store === "pgvector") {
        const hits = await searchPgVectorChunkIds({
            knowledgeBaseId,
            queryEmbedding: queryVector,
            limit: 200,
            minScore,
        });

        if (hits.length > 0) {
            const prisma = getPrismaClient();
            const chunkRows = await prisma.documentChunk.findMany({
                where: {
                    id: { in: hits.map((item) => item.chunkId) },
                    document: {
                        knowledgeBaseId,
                        status: DocumentStatus.INDEXED,
                    },
                },
                select: {
                    id: true,
                    content: true,
                    createdAt: true,
                    document: {
                        select: { title: true },
                    },
                },
            });

            const rowMap = new Map(chunkRows.map((row) => [row.id, row]));

            return hits
                .map((hit) => {
                    const row = rowMap.get(hit.chunkId);
                    if (!row) {
                        return null;
                    }

                    return {
                        chunkId: row.id,
                        text: `[${row.document.title}] ${row.content}`,
                        vectorScore: hit.score,
                        createdAt: row.createdAt.getTime(),
                    } satisfies VectorCandidate;
                })
                .filter((item): item is VectorCandidate => item !== null);
        }

        // Compatibility fallback: if pgvector has no rows yet, use JSON vectors.
    }

    const prisma = getPrismaClient();
    const rows = await prisma.documentChunkEmbedding.findMany({
        where: {
            chunk: {
                document: {
                    knowledgeBaseId,
                    status: DocumentStatus.INDEXED,
                },
            },
        },
        select: {
            chunkId: true,
            vector: true,
            chunk: {
                select: {
                    content: true,
                    createdAt: true,
                    document: {
                        select: { title: true },
                    },
                },
            },
        },
        take: 100000,
    });

    const output: VectorCandidate[] = [];
    for (const row of rows) {
        const vector = parseVectorJson(row.vector);
        if (!vector) {
            continue;
        }

        const score = cosineSimilarity(queryVector, vector);
        if (score < minScore) {
            continue;
        }

        output.push({
            chunkId: row.chunkId,
            text: `[${row.chunk.document.title}] ${row.chunk.content}`,
            vectorScore: score,
            createdAt: row.chunk.createdAt.getTime(),
        });
    }

    return output;
}

function sortByScoreThenTime<T extends { createdAt: number }>(
    items: T[],
    getScore: (item: T) => number,
): T[] {
    return [...items].sort(
        (a, b) => getScore(b) - getScore(a) || b.createdAt - a.createdAt,
    );
}

export async function ingestPlainTextDocument(input: {
    title: string;
    content: string;
}): Promise<IngestResult> {
    const prisma = getPrismaClient();
    const title = sanitizeTitle(input.title);
    const content = input.content.trim();

    if (!content) {
        throw new AppError(400, "VALIDATION_ERROR", "Document content is empty");
    }

    const knowledgeBaseId = await ensureDefaultKnowledgeBaseId();
    const ragConfig = await getOrCreateRagConfigRecord(knowledgeBaseId);

    const textChunks = splitTextIntoChunks(
        content,
        ragConfig.chunkSize,
        ragConfig.chunkOverlap,
    );

    if (textChunks.length === 0) {
        throw new AppError(400, "VALIDATION_ERROR", "No valid chunks generated from document");
    }

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

    const chunks = await prisma.documentChunk.findMany({
        where: { documentId: document.id },
        select: {
            id: true,
            content: true,
            createdAt: true,
        },
        orderBy: { createdAt: "asc" },
    });

    const embeddedChunkCount = await embedDocumentChunks(
        knowledgeBaseId,
        title,
        chunks,
        ragConfig,
    );

    return {
        documentId: document.id,
        title,
        chunkCount: textChunks.length,
        charCount: content.length,
        embeddedChunkCount,
    };
}

export async function listIndexedDocuments(): Promise<
    Array<{ title: string; chunkCount: number; embeddedChunkCount: number }>
> {
    const prisma = getPrismaClient();
    const knowledgeBaseId = await ensureDefaultKnowledgeBaseId();

    const rows = await prisma.document.findMany({
        where: {
            knowledgeBaseId,
            status: DocumentStatus.INDEXED,
        },
        select: {
            id: true,
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

    return Promise.all(rows.map(async (row) => {
        const embeddedCount = await prisma.documentChunkEmbedding.count({
            where: { chunk: { documentId: row.id } }
        });
        return {
            title: row.title,
            chunkCount: row._count.chunks,
            embeddedChunkCount: embeddedCount,
        };
    }));
}

export async function getRagConfig(): Promise<RagConfigInfo> {
    const knowledgeBaseId = await ensureDefaultKnowledgeBaseId();
    const config = await getOrCreateRagConfigRecord(knowledgeBaseId);
    return toPublicRagConfig(config);
}

export async function updateRagConfig(
    input: RagConfigUpdateInput,
): Promise<RagConfigInfo> {
    const knowledgeBaseId = await ensureDefaultKnowledgeBaseId();
    const prisma = getPrismaClient();
    const existing = await getOrCreateRagConfigRecord(knowledgeBaseId);

    const nextMode =
        input.retrieverMode !== undefined
            ? parseMode(input.retrieverMode) ?? (() => {
                  throw new AppError(
                      400,
                      "VALIDATION_ERROR",
                      "retrieverMode must be one of keyword|vector|hybrid",
                  );
              })()
            : modeFromPrisma(existing.retrieverMode);

    const nextStore =
        input.vectorStore !== undefined
            ? parseVectorStore(input.vectorStore) ?? (() => {
                  throw new AppError(
                      400,
                      "VALIDATION_ERROR",
                      "vectorStore must be one of database|memory|pgvector",
                  );
              })()
            : vectorStoreFromPrisma(existing.vectorStore);

    const nextChunkSize =
        input.chunkSize !== undefined
            ? clampInteger(input.chunkSize, 200, 8000)
            : existing.chunkSize;

    const nextChunkOverlap =
        input.chunkOverlap !== undefined
            ? clampInteger(input.chunkOverlap, 0, Math.max(0, nextChunkSize - 1))
            : clampInteger(existing.chunkOverlap, 0, Math.max(0, nextChunkSize - 1));

    const nextTopK =
        input.topK !== undefined
            ? clampInteger(input.topK, 1, 20)
            : existing.topK;

    const nextMinScore =
        input.minScore !== undefined
            ? clampFloat(input.minScore, 0, 1)
            : existing.minScore;

    const nextEmbeddingEndpoint =
        input.embeddingEndpoint !== undefined
            ? trimOrEmpty(input.embeddingEndpoint)
            : existing.embeddingEndpoint ?? "";

    const nextEmbeddingModel =
        input.embeddingModel !== undefined
            ? trimOrEmpty(input.embeddingModel)
            : existing.embeddingModel ?? "";

    const nextEmbeddingApiKey =
        input.embeddingApiKey !== undefined
            ? trimOrEmpty(input.embeddingApiKey)
            : existing.embeddingApiKey ?? "";

    const nextEmbeddingDimensions =
        input.embeddingDimensions !== undefined
            ? clampInteger(input.embeddingDimensions, 64, 8192)
            : existing.embeddingDimensions ?? DEFAULT_EMBEDDING_DIMS;

    const normalizedEndpoint = nextEmbeddingEndpoint
        ? normalizeEmbeddingEndpoint(
              validateHttpUrl(nextEmbeddingEndpoint, "embeddingEndpoint"),
          )
        : "";

    if (nextStore === "pgvector") {
        await ensurePgVectorReady().catch((err) => {
            const message =
                err instanceof Error
                    ? err.message
                    : "pgvector initialization failed";
            throw new AppError(400, "VALIDATION_ERROR", message);
        });

        const currentStore = vectorStoreFromPrisma(existing.vectorStore);
        if (currentStore !== "pgvector") {
            await syncPgVectorStoreFromEmbeddings(knowledgeBaseId).catch((err) => {
                const message =
                    err instanceof Error
                        ? err.message
                        : "failed to sync existing vectors into pgvector";
                throw new AppError(500, "INTERNAL_ERROR", message);
            });
        }
    }

    const updated = await prisma.ragConfig.update({
        where: { knowledgeBaseId },
        data: {
            retrieverMode: modeToPrisma(nextMode),
            vectorStore: vectorStoreToPrisma(nextStore),
            chunkSize: nextChunkSize,
            chunkOverlap: nextChunkOverlap,
            topK: nextTopK,
            minScore: nextMinScore,
            embeddingEndpoint: normalizedEndpoint || null,
            embeddingModel: nextEmbeddingModel || null,
            embeddingApiKey: nextEmbeddingApiKey || null,
            embeddingDimensions: nextEmbeddingDimensions,
        },
    });

    // Config change can invalidate memory index assumptions.
    memoryVectorStore.delete(knowledgeBaseId);

    return toPublicRagConfig(updated);
}

export async function testEmbeddingConnection(
    endpoint: string,
    model: string,
    apiKey: string,
    dimensions: number
): Promise<{ ok: boolean; vectorSize?: number; message?: string }> {
    try {
        const normalizedEndpoint = normalizeEmbeddingEndpoint(
            validateHttpUrl(endpoint, "embeddingEndpoint"),
        );
        
        if (!normalizedEndpoint || !model || !apiKey) {
             return { ok: false, message: "Missing required embedding configuration fields" };
        }
        
        const runtime = {
             provider: "custom" as const,
             endpoint: normalizedEndpoint,
             model: model,
             apiKey: apiKey,
             dimensions: dimensions
        };
        
        const vector = await createEmbedding("Test connection", runtime);
        return { ok: true, vectorSize: vector.length };
    } catch (err) {
        return { 
             ok: false, 
             message: err instanceof Error ? err.message : "Unknown error during embedding test" 
        };
    }
}

export async function retrieveFromIndexedDocuments(
    prompt: string,
    limit?: number,
): Promise<RetrievalHit[]> {
    const knowledgeBaseId = await ensureDefaultKnowledgeBaseId();
    const ragConfig = await getOrCreateRagConfigRecord(knowledgeBaseId);
    const effectiveLimit = clampInteger(limit ?? ragConfig.topK, 1, 50);
    const mode = modeFromPrisma(ragConfig.retrieverMode);

    let candidates: Array<{ chunkId: string; text: string; score: number }> = [];

    if (mode === "keyword") {
        const keyword = await retrieveKeywordCandidates(knowledgeBaseId, prompt);
        candidates = sortByScoreThenTime(keyword, (item) => item.keywordScore)
            .map((item) => ({ chunkId: item.chunkId, text: item.text, score: item.keywordScore }));
    } else if (mode === "vector") {
        const vector = await retrieveVectorCandidates(
            knowledgeBaseId,
            prompt,
            ragConfig,
        ).catch(() => []);
        candidates = sortByScoreThenTime(vector, (item) => item.vectorScore)
            .map((item) => ({ chunkId: item.chunkId, text: item.text, score: item.vectorScore }));
    } else {
        const [keyword, vector] = await Promise.all([
            retrieveKeywordCandidates(knowledgeBaseId, prompt).catch(() => []),
            retrieveVectorCandidates(knowledgeBaseId, prompt, ragConfig).catch(() => []),
        ]);

        const keywordMax = Math.max(1, ...keyword.map((item) => item.keywordScore));
        const merged = new Map<
            string,
            {
                text: string;
                createdAt: number;
                keywordScore: number;
                vectorScore: number;
            }
        >();

        for (const row of keyword) {
            merged.set(row.chunkId, {
                text: row.text,
                createdAt: row.createdAt,
                keywordScore: row.keywordScore / keywordMax,
                vectorScore: 0,
            });
        }

        for (const row of vector) {
            const prev = merged.get(row.chunkId);
            if (!prev) {
                merged.set(row.chunkId, {
                    text: row.text,
                    createdAt: row.createdAt,
                    keywordScore: 0,
                    vectorScore: row.vectorScore,
                });
                continue;
            }

            prev.vectorScore = Math.max(prev.vectorScore, row.vectorScore);
            prev.createdAt = Math.max(prev.createdAt, row.createdAt);
        }

        const ranked = Array.from(merged.entries()).map(([chunkId, data]) => ({ chunkId, ...data })).sort((a, b) => {
            const scoreA = a.vectorScore * 0.75 + a.keywordScore * 0.25;
            const scoreB = b.vectorScore * 0.75 + b.keywordScore * 0.25;
            return scoreB - scoreA || b.createdAt - a.createdAt;
        });

        candidates = ranked.map(item => ({ chunkId: item.chunkId, text: item.text, score: item.vectorScore > 0 ? item.vectorScore : item.keywordScore }));
    }

    const topCandidates = candidates.slice(0, effectiveLimit);
    if (topCandidates.length === 0) {
        return [];
    }

    const chunkIds = topCandidates.map(c => c.chunkId);
    const prisma = getPrismaClient();
    const finalChunks = await prisma.documentChunk.findMany({
        where: { id: { in: chunkIds } },
        select: {
            id: true,
            content: true,
            documentId: true,
            document: { select: { title: true } }
        }
    });

    const chunkMap = new Map(finalChunks.map(c => [c.id, c]));

    return topCandidates.map(item => {
        const c = chunkMap.get(item.chunkId);
        return {
            documentId: c?.documentId ?? "",
            documentTitle: c?.document.title ?? "",
            content: c?.content ?? "",
            text: item.text,
            score: item.score
        };
    }).filter(c => !!c.documentId);
}

export async function getRagStrategyInfo(): Promise<{
    mode: RagRetrieverMode;
    shouldUseVectorDb: boolean;
    reason: string;
}> {
    const knowledgeBaseId = await ensureDefaultKnowledgeBaseId();
    const prisma = getPrismaClient();
    const ragConfig = await getOrCreateRagConfigRecord(knowledgeBaseId);
    const mode = modeFromPrisma(ragConfig.retrieverMode);

    const indexedChunkCount = await prisma.documentChunk.count({
        where: {
            document: {
                knowledgeBaseId,
                status: DocumentStatus.INDEXED,
            },
        },
    });

    if (mode === "keyword") {
        if (indexedChunkCount >= 2000) {
            return {
                mode,
                shouldUseVectorDb: true,
                reason: "Corpus is large; switch to Vector/Hybrid retrieval for better recall quality.",
            };
        }

        return {
            mode,
            shouldUseVectorDb: false,
            reason: "Keyword mode is suitable for small corpus and initial validation.",
        };
    }

    const runtime = resolveEmbeddingRuntimeConfig(ragConfig);
    if (!runtime) {
        return {
            mode,
            shouldUseVectorDb: false,
            reason: "Embedding config is incomplete (endpoint/model/apiKey).",
        };
    }

    const store = vectorStoreFromPrisma(ragConfig.vectorStore);
    if (store === "pgvector") {
        const installed = await isPgVectorExtensionInstalled().catch(() => false);
        if (!installed) {
            return {
                mode,
                shouldUseVectorDb: false,
                reason: "pgvector extension is not installed in PostgreSQL.",
            };
        }
    }

    const embeddedChunkCount = await prisma.documentChunkEmbedding.count({
        where: {
            chunk: {
                document: {
                    knowledgeBaseId,
                    status: DocumentStatus.INDEXED,
                },
            },
        },
    });

    if (embeddedChunkCount === 0) {
        return {
            mode,
            shouldUseVectorDb: false,
            reason: "Vector retrieval configured but no embedding data found. Upload or rebuild index first.",
        };
    }

    return {
        mode,
        shouldUseVectorDb: true,
        reason:
            mode === "hybrid"
                ? "Hybrid mode is active: keyword recall and vector similarity are fused for ranking."
                : "Vector mode is active: semantic retrieval is based on embedding similarity.",
    };
}
