export declare class ChatStreamService {
    private readonly queue;
    private readonly canceledRuns;
    private readonly maxRunMs;
    cancelRun(runId: string): void;
    createStream(prompt: string, signal: AbortSignal): ReadableStream<Uint8Array>;
}
export declare const chatStreamService: ChatStreamService;
//# sourceMappingURL=chat-stream.service.d.ts.map