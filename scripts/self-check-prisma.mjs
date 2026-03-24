import { spawn } from "node:child_process";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";
import { Client } from "pg";

const baseUrl = process.env.BACKEND_BASE_URL ?? "http://localhost:3101";
const prompt = `self_check_${Date.now()}`;
const databaseUrl = process.env.DATABASE_URL;
const serverUrl = new URL(baseUrl);
const serverPort = Number(serverUrl.port || "80");

if (!databaseUrl) {
    console.error("[self-check] DATABASE_URL is required.");
    process.exit(1);
}

async function isServerReady() {
    try {
        const res = await fetch(`${baseUrl}/api/health`);
        return res.ok;
    } catch {
        return false;
    }
}

async function waitForServer(maxMs) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < maxMs) {
        if (await isServerReady()) {
            return true;
        }
        await sleep(600);
    }
    return false;
}

async function runStreamUntilTerminal() {
    const res = await fetch(
        `${baseUrl}/api/chat/stream?prompt=${encodeURIComponent(prompt)}`,
    );

    if (!res.ok || !res.body) {
        throw new Error(`stream request failed with status ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let runId = null;

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            let sepIndex = buffer.indexOf("\n\n");

            while (sepIndex !== -1) {
                const frame = buffer.slice(0, sepIndex);
                buffer = buffer.slice(sepIndex + 2);
                sepIndex = buffer.indexOf("\n\n");

                const dataLine = frame
                    .split("\n")
                    .find((line) => line.startsWith("data:"));

                if (!dataLine) {
                    continue;
                }

                const payloadText = dataLine.slice(5).trim();
                if (!payloadText) {
                    continue;
                }

                const payload = JSON.parse(payloadText);
                if (payload?.type === "run_start" && payload?.runId) {
                    runId = payload.runId;
                    continue;
                }

                if (payload?.type === "done") {
                    return { runId, streamTerminal: "done" };
                }

                if (payload?.type === "error") {
                    return { runId, streamTerminal: "error" };
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    if (!runId) {
        throw new Error("run_start event not found from stream");
    }

    return { runId, streamTerminal: "eof" };
}

async function waitForRunTerminal(runId, maxMs) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < maxMs) {
        const res = await fetch(`${baseUrl}/api/chat/stream/runs/${runId}`);
        if (res.ok) {
            const body = await res.json();
            const run = body?.data?.run;
            if (
                run?.status === "SUCCEEDED" ||
                run?.status === "FAILED" ||
                run?.status === "CANCELED"
            ) {
                return run;
            }
        }

        await sleep(500);
    }

    throw new Error("run did not reach terminal state in time");
}

async function assertRunPersisted(runId) {
    const client = new Client({ connectionString: databaseUrl });

    try {
        await client.connect();
        for (let i = 0; i < 20; i += 1) {
            const result = await client.query(
                'SELECT id, status, input FROM "AgentRun" WHERE id = $1 LIMIT 1',
                [runId],
            );

            if (result.rows.length > 0) {
                return result.rows[0];
            }

            await sleep(300);
        }

        throw new Error(`AgentRun row not found for ${runId}`);
    } finally {
        await client.end().catch(() => undefined);
    }
}

async function main() {
    console.log(
        `[self-check] starting isolated agent-server on ${baseUrl} in prisma mode...`,
    );

    const child = spawn(
        "pnpm",
        ["--filter", "agent-server", "exec", "tsx", "src/index.ts"],
        {
            env: {
                ...process.env,
                CHAT_RUN_STORE: "prisma",
                PORT: String(serverPort),
            },
            stdio: ["ignore", "pipe", "pipe"],
        },
    );

    child.stdout?.on("data", (chunk) => {
        const text = chunk.toString();
        if (text.trim()) {
            console.log(`[backend] ${text.trim()}`);
        }
    });

    child.stderr?.on("data", (chunk) => {
        const text = chunk.toString();
        if (text.trim()) {
            console.error(`[backend:err] ${text.trim()}`);
        }
    });

    const ready = await waitForServer(30000);
    if (!ready) {
        child.kill("SIGTERM");
        throw new Error("backend did not become ready within 30s");
    }

    try {
        const healthDbRes = await fetch(`${baseUrl}/api/health/db`);
        const healthDbBody = await healthDbRes.json();

        if (!healthDbRes.ok) {
            throw new Error(
                `db health failed: ${JSON.stringify(healthDbBody)}`,
            );
        }

        console.log(
            `[self-check] /api/health/db ok: ${JSON.stringify(healthDbBody.data ?? healthDbBody)}`,
        );

        const streamResult = await runStreamUntilTerminal();
        const runId = streamResult.runId;
        if (!runId) {
            throw new Error("runId missing from stream events");
        }

        console.log(`[self-check] captured runId: ${runId}`);
        console.log(
            `[self-check] stream terminal: ${streamResult.streamTerminal}`,
        );

        const run = await waitForRunTerminal(runId, 15000);
        console.log(`[self-check] run terminal status: ${run.status}`);

        const row = await assertRunPersisted(runId);
        console.log(`[self-check] persisted row: ${JSON.stringify(row)}`);

        console.log("[self-check] PASS: Prisma persistence path verified.");
    } finally {
        child.kill("SIGTERM");
    }
}

main().catch((err) => {
    console.error(
        `[self-check] FAIL: ${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
});
