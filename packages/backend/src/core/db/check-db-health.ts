import { Client } from "pg";

export interface DbHealthResult {
    ok: boolean;
    latencyMs: number | null;
    database: string | null;
    reason?: string;
}

export async function checkDatabaseHealth(): Promise<DbHealthResult> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        return {
            ok: false,
            latencyMs: null,
            database: null,
            reason: "DATABASE_URL is not configured",
        };
    }

    const started = Date.now();
    const client = new Client({ connectionString });

    try {
        await client.connect();
        const result = await client.query<{ current_database: string }>(
            "SELECT current_database()",
        );

        return {
            ok: true,
            latencyMs: Date.now() - started,
            database: result.rows[0]?.current_database ?? null,
        };
    } catch (err) {
        const reason = err instanceof Error ? err.message : "unknown error";
        return {
            ok: false,
            latencyMs: Date.now() - started,
            database: null,
            reason,
        };
    } finally {
        await client.end().catch(() => undefined);
    }
}
