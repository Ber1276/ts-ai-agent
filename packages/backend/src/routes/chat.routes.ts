import { Hono } from "hono";
import { createSuccessResponse } from "share";
import { generateChatResponse } from "../modules/chat/chat.service.js";
import { chatStreamService } from "../modules/chat/chat-stream.service.js";
import {
    parseCancelRunId,
    parseChatRequest,
    parseChatStreamRequest,
} from "../modules/chat/chat.validator.js";

export const chatRoutes = new Hono()
    .post("/", async (c) => {
        const payload = await c.req.json();
        const req = parseChatRequest(payload);
        const response = await generateChatResponse(req);

        return c.json(createSuccessResponse(response));
    })
    .post("/stream/cancel", async (c) => {
        const payload = await c.req.json().catch(() => null);
        const runId = parseCancelRunId(payload);

        chatStreamService.cancelRun(runId);
        return c.json(createSuccessResponse({ runId, canceled: true }));
    })
    .get("/stream/runs/:runId", async (c) => {
        const runId = c.req.param("runId");
        const run = await chatStreamService.getRun(runId);

        return c.json(createSuccessResponse({ run }));
    })
    .get("/stream/runs", async (c) => {
        const runs = await chatStreamService.listRuns();
        return c.json(createSuccessResponse({ runs }));
    })
    .delete("/stream/runs/:runId", async (c) => {
        const runId = c.req.param("runId");
        await chatStreamService.deleteRun(runId);
        return c.json(createSuccessResponse({ success: true }));
    })
    .post("/stream", async (c) => {
        const payload = await c.req.json().catch(() => null);
        const req = parseChatStreamRequest(payload);
        const stream = chatStreamService.createStream(
            req.prompt,
            c.req.raw.signal,
            req.modelSelection,
        );

        return c.newResponse(stream, 200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        });
    })
    .get("/stream", (c) => {
        const prompt = c.req.query("prompt") ?? "";
        const stream = chatStreamService.createStream(
            prompt,
            c.req.raw.signal,
            undefined,
        );

        return c.newResponse(stream, 200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        });
    });
