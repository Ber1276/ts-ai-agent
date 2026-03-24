import { Hono } from "hono";
import { chatRoutes } from "./chat.routes.js";
import { healthRoutes } from "./health.routes.js";
import { modelRoutes } from "./model.routes.js";
import { ragRoutes } from "./rag.routes.js";

export const apiRoutes = new Hono()
    .route("/", healthRoutes)
    .route("/chat", chatRoutes)
    .route("/model-services", modelRoutes)
    .route("/rag", ragRoutes);
