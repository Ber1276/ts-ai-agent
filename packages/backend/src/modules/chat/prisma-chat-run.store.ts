import { getPrismaClient } from "../../core/db/prisma-client.js";
import type { ChatRunStore, PersistedRun } from "./chat-run.store.js";

export class PrismaChatRunStore implements ChatRunStore {
    private contextPromise: Promise<{ agentId: string } | null> | null = null;

    async createRun(runId: string, input: string): Promise<void> {
        const prisma = getPrismaClient();
        const context = await this.ensureContext();
        if (!context) {
            throw new Error("Failed to resolve default agent context");
        }

        await prisma.agentRun.create({
            data: {
                id: runId,
                agentId: context.agentId,
                input,
                status: "QUEUED",
                startedAt: new Date(),
                events: ["QUEUED"],
            },
        });
    }

    async updateRun(
        runId: string,
        patch: Partial<PersistedRun>,
    ): Promise<void> {
        const prisma = getPrismaClient();

        await prisma.agentRun.update({
            where: { id: runId },
            data: {
                status: patch.status,
                outputSummary: patch.outputSummary || null,
                finishedAt: patch.finishedAt
                    ? new Date(patch.finishedAt)
                    : null,
            },
        });
    }

    async appendEvent(runId: string, event: string): Promise<void> {
        const prisma = getPrismaClient();
        const run = await prisma.agentRun.findUnique({
            where: { id: runId },
            select: {
                events: true,
            },
        });

        if (!run) {
            return;
        }

        const currentEvents = Array.isArray(run.events)
            ? run.events.map((item) => String(item))
            : [];

        await prisma.agentRun.update({
            where: { id: runId },
            data: {
                events: [...currentEvents, event],
            },
        });
    }

    async getRun(runId: string): Promise<PersistedRun | null> {
        const prisma = getPrismaClient();

        const run = await prisma.agentRun.findUnique({
            where: { id: runId },
            include: {
                retrievalHits: {
                    select: {
                        snippet: true,
                        score: true,
                    },
                    orderBy: {
                        score: "desc",
                    },
                    take: 5,
                },
            },
        });

        if (!run) {
            return null;
        }

        const events = Array.isArray(run.events)
            ? run.events.map((item) => String(item))
            : [];

        return {
            runId: run.id,
            status: run.status,
            input: run.input,
            outputSummary: run.outputSummary ?? "",
            retrievalHits: run.retrievalHits
                .map((item) => item.snippet)
                .filter((item): item is string => Boolean(item)),
            errorMessage: null,
            startedAt: (run.startedAt ?? run.createdAt).toISOString(),
            finishedAt: run.finishedAt?.toISOString() ?? null,
            updatedAt: run.updatedAt.toISOString(),
            events,
        };
    }

    private async ensureContext(): Promise<{ agentId: string } | null> {
        if (!this.contextPromise) {
            this.contextPromise = this.resolveContext();
        }

        return this.contextPromise;
    }

    private async resolveContext(): Promise<{ agentId: string } | null> {
        const prisma = getPrismaClient();

        const userEmail =
            process.env.CHAT_RUN_STORE_USER_EMAIL ?? "dev@local.agent";
        const userName = process.env.CHAT_RUN_STORE_USER_NAME ?? "Dev User";
        const agentName =
            process.env.CHAT_RUN_STORE_AGENT_NAME ?? "default-agent";

        const user = await prisma.user.upsert({
            where: { email: userEmail },
            update: { name: userName },
            create: { email: userEmail, name: userName },
        });

        const agent = await prisma.agent.upsert({
            where: {
                userId_name: {
                    userId: user.id,
                    name: agentName,
                },
            },
            update: {},
            create: {
                name: agentName,
                userId: user.id,
                description: "Auto-created agent for stream run persistence",
            },
        });

        return { agentId: agent.id };
    }
}

export function createPrismaChatRunStore(): ChatRunStore {
    return new PrismaChatRunStore();
}
