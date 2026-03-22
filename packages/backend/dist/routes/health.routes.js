import { Hono } from "hono";
import { createSuccessResponse } from "share";
export const healthRoutes = new Hono().get("/health", (c) => {
    return c.json(createSuccessResponse({
        status: "ok",
        time: new Date().toISOString(),
    }));
});
