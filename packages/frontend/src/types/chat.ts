export type UIMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
    metadata?: {
        rag?: boolean;
        thinking?: string;
        sourceDocuments?: Array<{
            id: string;
            title: string;
            score?: number;
        }>;
    };
};

export type ChatStatus = "idle" | "loading" | "streaming";
