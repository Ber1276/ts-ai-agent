import { Hono } from "hono";
import {
    type ModelServiceSaveRequest,
    type ModelServiceTestRequest,
    createSuccessResponse,
} from "share";
import {
    deleteModelServiceById,
    getModelServiceItems,
    saveModelService,
    testModelSelection,
} from "../modules/model/model-service.js";
import { AppError } from "../core/errors/app-error.js";

export const modelRoutes = new Hono()
    .get("/", async (c) => {
        const services = await getModelServiceItems();
        return c.json(createSuccessResponse({ services }));
    })
    .post("/", async (c) => {
        const payload = (await c.req
            .json()
            .catch(() => null)) as ModelServiceSaveRequest | null;

        if (!payload?.service) {
            throw new AppError(
                400,
                "VALIDATION_ERROR",
                "service payload is required",
            );
        }

        const saved = await saveModelService(payload.service);
        const services = await getModelServiceItems();
        return c.json(createSuccessResponse({ saved, services }));
    })
    .put("/:id", async (c) => {
        const id = c.req.param("id").trim();
        const payload = (await c.req
            .json()
            .catch(() => null)) as ModelServiceSaveRequest | null;

        if (!id || !payload?.service) {
            throw new AppError(
                400,
                "VALIDATION_ERROR",
                "service id and payload are required",
            );
        }

        const saved = await saveModelService({
            ...payload.service,
            id,
        });
        const services = await getModelServiceItems();
        return c.json(createSuccessResponse({ saved, services }));
    })
    .delete("/:id", async (c) => {
        const id = c.req.param("id").trim();
        if (!id) {
            throw new AppError(
                400,
                "VALIDATION_ERROR",
                "service id is required",
            );
        }

        await deleteModelServiceById(id);
        const services = await getModelServiceItems();
        return c.json(createSuccessResponse({ id, services }));
    })
    .post("/test", async (c) => {
        const payload = (await c.req
            .json()
            .catch(() => null)) as ModelServiceTestRequest | null;

        const result = await testModelSelection(payload?.modelSelection ?? {});
        return c.json(createSuccessResponse({ result }));
    });
