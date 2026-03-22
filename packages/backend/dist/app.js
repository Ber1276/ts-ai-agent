import { Hono } from "hono";
import { apiRoutes } from "./routes/api.routes.js";
import { registerErrorHandlers } from "./core/http/register-error-handlers.js";
export const app = new Hono();
registerErrorHandlers(app);
const route = app
    .get("/", (c) => {
    return c.text("AI Agent Backend is running");
})
    .route("/api", apiRoutes);
