import { hc } from "hono/client";
import type { InferRequestType, InferResponseType } from "hono/client";
import type { AppType } from "agent-server/app";
import { MessageRole } from "share";

const client = hc<AppType>("/");
type PostChatRequest = InferRequestType<typeof client.api.chat.$post>;
type PostChatResponse = InferResponseType<typeof client.api.chat.$post>;

export const fetchChatResponse = async (message: string): Promise<string> => {
    const payload: PostChatRequest = {
        json: {
            message: {
                id: `msg-${Date.now()}`,
                role: MessageRole.USER,
                content: message,
                timestamp: Date.now(),
            },
        },
    };

    const res = await client.api.chat.$post(payload);

    if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
    }

    const response: PostChatResponse = await res.json();

    if (!response.success) {
        throw new Error(response.error?.message || "No response data received");
    }

    if (!("data" in response) || !response.data) {
        throw new Error("No response data received");
    }

    return response.data.response;
};
