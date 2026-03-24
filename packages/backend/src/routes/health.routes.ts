import { Hono } from "hono";
import {
    ApiErrorCode,
    createErrorResponse,
    createSuccessResponse,
} from "share";
import { checkDatabaseHealth } from "../core/db/check-db-health.js";

export const healthRoutes = new Hono()
    .get("/health", (c) => {
        return c.json(
            createSuccessResponse({
                status: "ok",
                time: new Date().toISOString(),
            }),
        );
    })
    .get("/health/db", async (c) => {
        const db = await checkDatabaseHealth();
        const storeMode = "prisma";

        if (!db.ok) {
            return c.json(
                createErrorResponse(
                    ApiErrorCode.INTERNAL_ERROR,
                    "Database health check failed",
                    {
                        storeMode,
                        latencyMs: db.latencyMs,
                        reason: db.reason,
                    },
                ),
                503,
            );
        }

        return c.json(
            createSuccessResponse({
                status: "ok",
                time: new Date().toISOString(),
                storeMode,
                db: {
                    connected: true,
                    database: db.database,
                    latencyMs: db.latencyMs,
                },
            }),
        );
    });
