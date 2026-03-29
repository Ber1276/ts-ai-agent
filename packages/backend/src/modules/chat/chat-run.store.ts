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
    createRun(runId: string, input: string): Promise<void>;
    updateRun(runId: string, patch: Partial<PersistedRun>): Promise<void>;
    appendEvent(runId: string, event: string): Promise<void>;
    getRun(runId: string): Promise<PersistedRun | null>;
    listRuns(): Promise<PersistedRun[]>;
    deleteRun(runId: string): Promise<void>;
}

import { createPrismaChatRunStore } from "./prisma-chat-run.store.js";

/**
 * Factory entry for run persistence.
 * Database is the only supported persistence layer.
 */
export function createChatRunStore(): ChatRunStore {
    return createPrismaChatRunStore();
}
