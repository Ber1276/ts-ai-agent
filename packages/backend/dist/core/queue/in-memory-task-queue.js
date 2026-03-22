export class InMemoryTaskQueue {
    jobs = [];
    running = false;
    enqueue(job) {
        this.jobs.push(job);
        void this.drain();
    }
    async drain() {
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
            }
            catch (err) {
                console.error("Queue job failed:", err);
            }
        }
        this.running = false;
    }
}
