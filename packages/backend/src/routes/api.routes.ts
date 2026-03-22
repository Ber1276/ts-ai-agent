import { Hono } from "hono";
import { chatRoutes } from "./chat.routes.js";
import { healthRoutes } from "./health.routes.js";

export const apiRoutes = new Hono()
    .route("/", healthRoutes)
    .route("/chat", chatRoutes);
