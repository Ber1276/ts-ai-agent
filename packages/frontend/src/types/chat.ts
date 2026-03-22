export type UIMessage = {
    id: string;
    role: "user" | "assistant";
    content: string;
};

export type ChatStatus = "idle" | "loading" | "streaming";
