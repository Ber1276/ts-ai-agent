type QueueJob = () => Promise<void>;

export class InMemoryTaskQueue {
    private jobs: QueueJob[] = [];
    private running = false;

    enqueue(job: QueueJob): void {
        this.jobs.push(job);
        void this.drain();
    }

    private async drain(): Promise<void> {
        if (this.running) {
            return;
        }

        this.running = true;
        while (this.jobs.length > 0) {
            const current = this.jobs.shift();
            if (!current) {
                continue;
            }

            try {
                await current();
            } catch (err) {
                console.error("Queue job failed:", err);
            }
        }
        this.running = false;
    }
}
