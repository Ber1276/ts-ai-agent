import type { ChatRunStore, PersistedRun } from "./chat-run.store.js";

/**
 * Prisma-backed run store.
 *
 * Design note:
 * - ChatRunStore API is synchronous by design (to keep stream state updates simple).
 * - We keep an in-memory mirror for fast reads and enqueue async DB writes in background.
 */
export class PrismaChatRunStore implements ChatRunStore {
    private prisma: Record<string, unknown> | null = null;
    private readonly cache = new Map<string, PersistedRun>();
    private writeChain: Promise<void> = Promise.resolve();
    private canPersist = true;
    private contextPromise: Promise<{ agentId: string } | null> | null = null;

    constructor() {
        // Lazy init in background-write path. Constructor stays sync for DI ergonomics.
    }

    createRun(runId: string, input: string): void {
        const now = new Date().toISOString();
        const run: PersistedRun = {
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
        };
        this.cache.set(runId, run);

        this.enqueueWrite(async () => {
            const prisma = await this.getPrisma();
            if (!prisma) {
                return;
            }
            const context = await this.ensureContext();
            if (!context) {
                return;
            }

            await (
                prisma as {
                    agentRun: { create: (arg: unknown) => Promise<unknown> };
                }
            ).agentRun.create({
                data: {
                    id: runId,
                    agentId: context.agentId,
                    input,
                    status: "QUEUED",
                    startedAt: new Date(now),
                    events: ["QUEUED"],
                },
            });
        });
    }

    updateRun(runId: string, patch: Partial<PersistedRun>): void {
        const current = this.cache.get(runId);
        if (!current) {
            return;
        }

        const next: PersistedRun = {
            ...current,
            ...patch,
            updatedAt: new Date().toISOString(),
        };
        this.cache.set(runId, next);

        this.enqueueWrite(async () => {
            const prisma = await this.getPrisma();
            if (!prisma) {
                return;
            }

            await (
                prisma as {
                    agentRun: { update: (arg: unknown) => Promise<unknown> };
                }
            ).agentRun.update({
                where: { id: runId },
                data: {
                    status: next.status,
                    outputSummary: next.outputSummary || null,
                    finishedAt: next.finishedAt
                        ? new Date(next.finishedAt)
                        : null,
                    events: next.events,
                },
            });
        });
    }

    appendEvent(runId: string, event: string): void {
        const current = this.cache.get(runId);
        if (!current) {
            return;
        }

        const next = {
            ...current,
            events: [...current.events, event],
            updatedAt: new Date().toISOString(),
        };
        this.cache.set(runId, next);

        this.enqueueWrite(async () => {
            const prisma = await this.getPrisma();
            if (!prisma) {
                return;
            }

            await (
                prisma as {
                    agentRun: { update: (arg: unknown) => Promise<unknown> };
                }
            ).agentRun.update({
                where: { id: runId },
                data: {
                    events: next.events,
                },
            });
        });
    }

    getRun(runId: string): PersistedRun | null {
        return this.cache.get(runId) ?? null;
    }

    private enqueueWrite(job: () => Promise<void>): void {
        this.writeChain = this.writeChain.then(job).catch((err) => {
            console.error("PrismaChatRunStore write failed:", err);
        });
    }

    private async ensureContext(): Promise<{ agentId: string } | null> {
        if (!this.canPersist) {
            return null;
        }

        if (!this.contextPromise) {
            this.contextPromise = this.resolveContext();
        }

        return this.contextPromise;
    }

    private async resolveContext(): Promise<{ agentId: string } | null> {
        const prisma = await this.getPrisma();
        if (!prisma) {
            return null;
        }

        const userEmail =
            process.env.CHAT_RUN_STORE_USER_EMAIL ?? "dev@local.agent";
        const userName = process.env.CHAT_RUN_STORE_USER_NAME ?? "Dev User";
        const agentName =
            process.env.CHAT_RUN_STORE_AGENT_NAME ?? "default-agent";

        const userDelegate = (prisma as { user: Record<string, unknown> })
            .user as {
            upsert: (arg: unknown) => Promise<{ id: string }>;
        };
        const agentDelegate = (prisma as { agent: Record<string, unknown> })
            .agent as {
            upsert: (arg: unknown) => Promise<{ id: string }>;
        };

        const user = await userDelegate.upsert({
            where: { email: userEmail },
            update: { name: userName },
            create: { email: userEmail, name: userName },
        });

        const agent = await agentDelegate.upsert({
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

    private async getPrisma(): Promise<Record<string, unknown> | null> {
        if (!this.canPersist) {
            return null;
        }

        if (this.prisma) {
            return this.prisma;
        }

        try {
            const mod = (await this.loadPrismaModule()) as unknown as {
                PrismaClient?: new (
                    ...args: unknown[]
                ) => Record<string, unknown>;
                default?: {
                    PrismaClient?: new (
                        ...args: unknown[]
                    ) => Record<string, unknown>;
                };
            };

            const Client = mod.PrismaClient ?? mod.default?.PrismaClient;
            if (!Client) {
                throw new Error("PrismaClient export not found");
            }

            const { PrismaPg } = (await import("@prisma/adapter-pg")) as {
                PrismaPg: new (arg: { connectionString: string }) => unknown;
            };
            const connectionString = process.env.DATABASE_URL;
            if (!connectionString) {
                throw new Error(
                    "DATABASE_URL is required for PrismaPg adapter",
                );
            }

            const adapter = new PrismaPg({ connectionString });
            this.prisma = new Client({ adapter });

            const hasAgentRun = Boolean(
                (this.prisma as { agentRun?: unknown }).agentRun,
            );
            const hasUser = Boolean((this.prisma as { user?: unknown }).user);
            const hasAgent = Boolean(
                (this.prisma as { agent?: unknown }).agent,
            );

            if (!hasAgentRun || !hasUser || !hasAgent) {
                this.canPersist = false;
                this.prisma = null;
                console.warn(
                    "PrismaChatRunStore disabled: prisma client is missing user/agent/agentRun models. Run prisma generate after schema updates.",
                );
                return null;
            }

            return this.prisma;
        } catch (err) {
            this.canPersist = false;
            this.prisma = null;
            console.warn(
                "PrismaChatRunStore disabled: failed to initialize @prisma/client. Fallback in-memory writes only.",
                err,
            );
            return null;
        }
    }

    private async loadPrismaModule(): Promise<unknown> {
        // Enterprise default: use @prisma/client from node_modules.
        // It is generated via `prisma generate` and stays independent from repo folder layout.
        return import("@prisma/client");
    }
}

export function createPrismaChatRunStore(): ChatRunStore {
    return new PrismaChatRunStore();
}
