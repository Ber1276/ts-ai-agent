export type PersistedRunStatus =
    | "QUEUED"
    | "RUNNING"
    | "STREAMING"
    | "SUCCEEDED"
    | "FAILED"
    | "CANCELED";

export interface PersistedRun {
    runId: string;
    status: PersistedRunStatus;
    input: string;
    outputSummary: string;
    retrievalHits: string[];
    errorMessage: string | null;
    startedAt: string;
    finishedAt: string | null;
    updatedAt: string;
    events: string[];
}

export interface ChatRunStore {
    createRun(runId: string, input: string): void;
    updateRun(runId: string, patch: Partial<PersistedRun>): void;
    appendEvent(runId: string, event: string): void;
    getRun(runId: string): PersistedRun | null;
}

type StoreMode = "memory" | "prisma";

import { createPrismaChatRunStore } from "./prisma-chat-run.store.js";

/**
 * In-memory persistence adapter for local development.
 * TODO(handwrite): replace with Prisma adapter implementing ChatRunStore.
 */
export class InMemoryChatRunStore implements ChatRunStore {
    private readonly runs = new Map<string, PersistedRun>();

    createRun(runId: string, input: string): void {
        const now = new Date().toISOString();
        this.runs.set(runId, {
            runId,
            status: "QUEUED",
            input,
            outputSummary: "",
            retrievalHits: [],
            errorMessage: null,
            startedAt: now,
            finishedAt: null,
            updatedAt: now,
            events: ["QUEUED"],
        });
    }

    updateRun(runId: string, patch: Partial<PersistedRun>): void {
        const current = this.runs.get(runId);
        if (!current) {
            return;
        }

        this.runs.set(runId, {
            ...current,
            ...patch,
            updatedAt: new Date().toISOString(),
        });
    }

    appendEvent(runId: string, event: string): void {
        const current = this.runs.get(runId);
        if (!current) {
            return;
        }

        this.runs.set(runId, {
            ...current,
            events: [...current.events, event],
            updatedAt: new Date().toISOString(),
        });
    }

    getRun(runId: string): PersistedRun | null {
        return this.runs.get(runId) ?? null;
    }
}

/**
 * Factory entry for run persistence.
 *
 * - `CHAT_RUN_STORE=memory` (default): in-memory adapter.
 * - `CHAT_RUN_STORE=prisma`: Prisma adapter (requires `prisma generate`).
 */
export function createChatRunStore(mode?: StoreMode): ChatRunStore {
    const resolvedMode =
        mode ??
        ((process.env.CHAT_RUN_STORE as StoreMode | undefined) || "memory");

    if (resolvedMode === "prisma") {
        try {
            return createPrismaChatRunStore();
        } catch (err) {
            console.warn(
                "Failed to initialize Prisma run store, fallback to memory store:",
                err,
            );
        }
    }

    return new InMemoryChatRunStore();
}
