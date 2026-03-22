type QueueJob = () => Promise<void>;
export declare class InMemoryTaskQueue {
    private jobs;
    private running;
    enqueue(job: QueueJob): void;
    private drain;
}
export {};
//# sourceMappingURL=in-memory-task-queue.d.ts.map