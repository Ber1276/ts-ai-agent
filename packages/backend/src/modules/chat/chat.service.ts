import type { ChatRequest, ChatResponse } from "share";

export function generateChatResponse(req: ChatRequest): ChatResponse {
    // TODO(handwrite): replace mock reply with your real Agent orchestration entrypoint.
    // Required: load conversation context -> retrieval -> model call -> persistence.
    return {
        response: `Echo: ${req.message.content}`,
    };
}
