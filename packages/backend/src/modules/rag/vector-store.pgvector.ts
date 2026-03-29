import { Pool, type QueryResultRow } from "pg";

interface PgVectorHitRow extends QueryResultRow {
    chunk_id: string;
    score: number;
}

let pool: Pool | null = null;
let initialized = false;

function getPool(): Pool {
    if (pool) {
        return pool;
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is required for pgvector");
    }

    pool = new Pool({ connectionString });
    return pool;
}

function toVectorLiteral(vector: number[]): string {
    return `[${vector.map((item) => Number(item).toString()).join(",")}]`;
}

export async function isPgVectorExtensionInstalled(): Promise<boolean> {
    const result = await getPool().query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') AS exists`,
    );

    return Boolean(result.rows[0]?.exists);
}

export async function ensurePgVectorReady(): Promise<void> {
    if (initialized) {
        return;
    }

    const db = getPool();

    try {
        await db.query(`CREATE EXTENSION IF NOT EXISTS vector`);
    } catch {
        // Ignore permission errors here; we validate extension presence below.
    }

    const installed = await isPgVectorExtensionInstalled();
    if (!installed) {
        throw new Error(
            "pgvector extension is not installed. Install extension 'vector' in PostgreSQL first.",
        );
    }

    await db.query(`
        CREATE TABLE IF NOT EXISTS rag_chunk_vectors (
            chunk_id TEXT PRIMARY KEY,
            knowledge_base_id TEXT NOT NULL,
            embedding VECTOR NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    await db.query(
        `CREATE INDEX IF NOT EXISTS idx_rag_chunk_vectors_kb ON rag_chunk_vectors (knowledge_base_id)`,
    );

    try {
        await db.query(
            `CREATE INDEX IF NOT EXISTS idx_rag_chunk_vectors_embedding_ivfflat ON rag_chunk_vectors USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`,
        );
    } catch {
        // ivfflat may fail depending on extension/build. Retrieval still works without this index.
    }

    initialized = true;
}

export async function upsertPgVectorChunk(input: {
    chunkId: string;
    knowledgeBaseId: string;
    embedding: number[];
}): Promise<void> {
    await ensurePgVectorReady();

    const vectorLiteral = toVectorLiteral(input.embedding);

    await getPool().query(
        `
        INSERT INTO rag_chunk_vectors (chunk_id, knowledge_base_id, embedding, created_at, updated_at)
        VALUES ($1, $2, $3::vector, NOW(), NOW())
        ON CONFLICT (chunk_id)
        DO UPDATE SET
            knowledge_base_id = EXCLUDED.knowledge_base_id,
            embedding = EXCLUDED.embedding,
            updated_at = NOW()
    `,
        [input.chunkId, input.knowledgeBaseId, vectorLiteral],
    );
}

export async function searchPgVectorChunkIds(input: {
    knowledgeBaseId: string;
    queryEmbedding: number[];
    limit: number;
    minScore: number;
}): Promise<Array<{ chunkId: string; score: number }>> {
    await ensurePgVectorReady();

    const vectorLiteral = toVectorLiteral(input.queryEmbedding);

    const result = await getPool().query<PgVectorHitRow>(
        `
        SELECT
            chunk_id,
            1 - (embedding <=> $2::vector) AS score
        FROM rag_chunk_vectors
        WHERE knowledge_base_id = $1
        ORDER BY embedding <=> $2::vector
        LIMIT $3
    `,
        [input.knowledgeBaseId, vectorLiteral, input.limit],
    );

    return result.rows
        .map((row) => ({
            chunkId: row.chunk_id,
            score: Number(row.score),
        }))
        .filter((item) => Number.isFinite(item.score) && item.score >= input.minScore);
}
