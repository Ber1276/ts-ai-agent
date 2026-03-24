import { Hono } from "hono";
import { createSuccessResponse } from "share";
import { generateChatResponse } from "../modules/chat/chat.service.js";
import { chatStreamService } from "../modules/chat/chat-stream.service.js";
import {
    parseCancelRunId,
    parseChatRequest,
} from "../modules/chat/chat.validator.js";

export const chatRoutes = new Hono()
    .post("/", async (c) => {
        const payload = await c.req.json();
        const req = parseChatRequest(payload);
        const response = generateChatResponse(req);

        return c.json(createSuccessResponse(response));
    })
    .post("/stream/cancel", async (c) => {
        const payload = await c.req.json().catch(() => null);
        const runId = parseCancelRunId(payload);

        chatStreamService.cancelRun(runId);
        return c.json(createSuccessResponse({ runId, canceled: true }));
    })
    .get("/stream/runs/:runId", (c) => {
        const runId = c.req.param("runId");
        const run = chatStreamService.getRun(runId);

        return c.json(createSuccessResponse({ run }));
    })
    .get("/stream", (c) => {
        const prompt = c.req.query("prompt") ?? "";
        const stream = chatStreamService.createStream(prompt, c.req.raw.signal);

        return c.newResponse(stream, 200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        });
    });
