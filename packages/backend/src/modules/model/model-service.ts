import { AppError } from "../../core/errors/app-error.js";
import { getPrismaClient } from "../../core/db/prisma-client.js";
import type {
    ModelSelectionInput,
    ModelServiceItem,
    ModelServiceSaveInput,
    ModelServiceTestResult,
} from "share";
import {
    logUpstreamHttpError,
    logUpstreamNetworkError,
    readUpstreamError,
} from "./upstream-error.js";

export interface ResolvedModelConfig {
    endpoint: string;
    model: string;
    apiKey: string;
    source: "preset" | "database" | "custom";
}

interface PresetModelService {
    id: string;
    label: string;
    endpoint: string;
    model: string;
    apiKeyEnv?: string;
}

interface ServiceContext {
    userId: string;
}

function trimOrEmpty(value: unknown): string {
    if (typeof value !== "string") {
        return "";
    }
    return value.trim();
}

function mustBeHttpUrl(input: string, field: string): string {
    try {
        const url = new URL(input);
        if (url.protocol !== "http:" && url.protocol !== "https:") {
            throw new Error("invalid protocol");
        }
        return url.toString();
    } catch {
        throw new AppError(
            400,
            "VALIDATION_ERROR",
            `${field} must be a valid http(s) URL`,
        );
    }
}

function normalizeOpenAiCompatibleEndpoint(endpoint: string): string {
    const url = new URL(endpoint);
    const pathname = url.pathname.replace(/\/+$/, "");

    if (pathname.endsWith("/chat/completions")) {
        return url.toString();
    }

    if (pathname === "/v1" || pathname === "/compatible-mode/v1") {
        url.pathname = `${pathname}/chat/completions`;
        return url.toString();
    }

    return url.toString();
}

async function getServiceContext(): Promise<ServiceContext> {
    const prisma = getPrismaClient();
    const userEmail = process.env.MODEL_CONFIG_USER_EMAIL ?? "dev@local.agent";
    const userName = process.env.MODEL_CONFIG_USER_NAME ?? "Dev User";

    const user = await prisma.user.upsert({
        where: { email: userEmail },
        update: { name: userName },
        create: { email: userEmail, name: userName },
    });

    return { userId: user.id };
}

function parsePresetServicesFromEnv(): PresetModelService[] {
    const raw = process.env.MODEL_SERVICE_PRESETS_JSON;
    if (!raw) {
        return [];
    }

    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }

        const output: PresetModelService[] = [];
        for (const item of parsed) {
            if (!item || typeof item !== "object") {
                continue;
            }

            const data = item as Partial<PresetModelService>;
            const id = trimOrEmpty(data.id);
            const label = trimOrEmpty(data.label);
            const endpoint = trimOrEmpty(data.endpoint);
            const model = trimOrEmpty(data.model);

            if (!id || !label || !endpoint || !model) {
                continue;
            }

            const apiKeyEnv = trimOrEmpty(data.apiKeyEnv);
            output.push({
                id: `preset:${id}`,
                label,
                endpoint,
                model,
                apiKeyEnv: apiKeyEnv || undefined,
            });
        }

        return output;
    } catch {
        return [];
    }
}

function buildDefaultPresetFromEnv(): PresetModelService | null {
    const endpoint = trimOrEmpty(process.env.LLM_API_ENDPOINT);
    const model = trimOrEmpty(process.env.LLM_API_MODEL);
    if (!endpoint || !model) {
        return null;
    }

    return {
        id: "preset:default-env",
        label: "Server Default",
        endpoint,
        model,
        apiKeyEnv: "LLM_API_KEY",
    };
}

function getPresetServices(): PresetModelService[] {
    const presets = parsePresetServicesFromEnv();
    const defaultPreset = buildDefaultPresetFromEnv();

    if (
        defaultPreset &&
        !presets.some((item) => item.id === defaultPreset.id)
    ) {
        return [defaultPreset, ...presets];
    }

    return presets;
}

function toModelServiceItemFromPreset(
    item: PresetModelService,
): ModelServiceItem {
    const envKey = item.apiKeyEnv;
    const envValue = envKey ? trimOrEmpty(process.env[envKey]) : "";

    return {
        id: item.id,
        label: item.label,
        endpoint: item.endpoint,
        model: item.model,
        needsClientApiKey: !envValue,
        isDefault: item.id === "preset:default-env",
        source: "preset",
    };
}

export async function getModelServiceItems(): Promise<ModelServiceItem[]> {
    const prisma = getPrismaClient();
    const context = await getServiceContext();

    const dbItems = await prisma.modelServiceConfig.findMany({
        where: {
            userId: context.userId,
            isActive: true,
        },
        orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });

    const dbServices: ModelServiceItem[] = dbItems.map((item) => ({
        id: `db:${item.id}`,
        label: item.label,
        endpoint: item.endpoint,
        model: item.model,
        needsClientApiKey: !trimOrEmpty(item.apiKey),
        isDefault: item.isDefault,
        source: "database",
    }));

    const presetServices = getPresetServices().map(
        toModelServiceItemFromPreset,
    );
    return [...dbServices, ...presetServices];
}

export async function saveModelService(
    input: ModelServiceSaveInput,
): Promise<ModelServiceItem> {
    const label = trimOrEmpty(input.label);
    const endpoint = mustBeHttpUrl(trimOrEmpty(input.endpoint), "endpoint");
    const model = trimOrEmpty(input.model);
    const hasProvidedApiKey = typeof input.apiKey === "string";
    const apiKey = hasProvidedApiKey ? trimOrEmpty(input.apiKey) : undefined;
    const requestedId = trimOrEmpty(input.id);

    if (!label || !model) {
        throw new AppError(
            400,
            "VALIDATION_ERROR",
            "label and model are required",
        );
    }

    const prisma = getPrismaClient();
    const context = await getServiceContext();

    const isDefault = Boolean(input.isDefault);

    if (isDefault) {
        await prisma.modelServiceConfig.updateMany({
            where: {
                userId: context.userId,
                isActive: true,
            },
            data: {
                isDefault: false,
            },
        });
    }

    const persisted = requestedId
        ? await prisma.modelServiceConfig.update({
              where: { id: requestedId },
              data: {
                  label,
                  endpoint,
                  model,
                  apiKey: hasProvidedApiKey ? (apiKey || null) : undefined,
                  isDefault,
                  isActive: true,
              },
          })
        : await prisma.modelServiceConfig.create({
              data: {
                  userId: context.userId,
                  label,
                  endpoint,
                  model,
                  apiKey: (apiKey ?? "") || null,
                  isDefault,
                  isActive: true,
              },
          });

    return {
        id: `db:${persisted.id}`,
        label: persisted.label,
        endpoint: persisted.endpoint,
        model: persisted.model,
        needsClientApiKey: !trimOrEmpty(persisted.apiKey),
        isDefault: persisted.isDefault,
        source: "database",
    };
}

export async function deleteModelServiceById(serviceId: string): Promise<void> {
    const id = trimOrEmpty(serviceId);
    if (!id) {
        throw new AppError(400, "VALIDATION_ERROR", "service id is required");
    }

    const prisma = getPrismaClient();
    const context = await getServiceContext();

    const existing = await prisma.modelServiceConfig.findFirst({
        where: {
            id,
            userId: context.userId,
            isActive: true,
        },
    });

    if (!existing) {
        throw new AppError(404, "NOT_FOUND", "Saved model service not found");
    }

    await prisma.modelServiceConfig.update({
        where: { id: existing.id },
        data: {
            isActive: false,
            isDefault: false,
        },
    });

    if (existing.isDefault) {
        const fallback = await prisma.modelServiceConfig.findFirst({
            where: {
                userId: context.userId,
                isActive: true,
            },
            orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        });

        if (fallback) {
            await prisma.modelServiceConfig.update({
                where: { id: fallback.id },
                data: { isDefault: true },
            });
        }
    }
}

function getPresetById(id: string): PresetModelService | null {
    return getPresetServices().find((item) => item.id === id) ?? null;
}

export async function resolveModelSelection(
    selection: ModelSelectionInput | undefined,
): Promise<ResolvedModelConfig | null> {
    const prisma = getPrismaClient();
    const context = await getServiceContext();

    const serviceId = trimOrEmpty(selection?.serviceId);

    if (serviceId.startsWith("db:")) {
        const id = serviceId.replace("db:", "").trim();
        if (!id) {
            throw new AppError(
                400,
                "VALIDATION_ERROR",
                "Invalid database service id",
            );
        }

        const item = await prisma.modelServiceConfig.findFirst({
            where: {
                id,
                userId: context.userId,
                isActive: true,
            },
        });

        if (!item) {
            throw new AppError(
                404,
                "NOT_FOUND",
                "Saved model service not found",
            );
        }

        const providedKey = trimOrEmpty(selection?.apiKey);
        const apiKey = providedKey || trimOrEmpty(item.apiKey);
        if (!apiKey) {
            throw new AppError(
                400,
                "VALIDATION_ERROR",
                "API key is required for selected service",
            );
        }

        return {
            endpoint: normalizeOpenAiCompatibleEndpoint(
                mustBeHttpUrl(item.endpoint, "endpoint"),
            ),
            model: item.model,
            apiKey,
            source: "database",
        };
    }

    if (serviceId.startsWith("preset:")) {
        const preset = getPresetById(serviceId);
        if (!preset) {
            throw new AppError(
                400,
                "VALIDATION_ERROR",
                `Unknown serviceId: ${serviceId}`,
            );
        }

        const providedKey = trimOrEmpty(selection?.apiKey);
        const envKey = preset.apiKeyEnv
            ? trimOrEmpty(process.env[preset.apiKeyEnv])
            : "";
        const apiKey = providedKey || envKey;

        if (!apiKey) {
            throw new AppError(
                400,
                "VALIDATION_ERROR",
                "API key is required for selected service",
            );
        }

        return {
            endpoint: normalizeOpenAiCompatibleEndpoint(
                mustBeHttpUrl(preset.endpoint, "endpoint"),
            ),
            model: preset.model,
            apiKey,
            source: "preset",
        };
    }

    const endpoint = trimOrEmpty(selection?.endpoint);
    const model = trimOrEmpty(selection?.model);
    const apiKey = trimOrEmpty(selection?.apiKey);

    if (endpoint || model || apiKey) {
        if (!endpoint || !model || !apiKey) {
            throw new AppError(
                400,
                "VALIDATION_ERROR",
                "Custom model selection requires endpoint, model, and apiKey",
            );
        }

        return {
            endpoint: normalizeOpenAiCompatibleEndpoint(
                mustBeHttpUrl(endpoint, "endpoint"),
            ),
            model,
            apiKey,
            source: "custom",
        };
    }

    const defaultDbConfig = await prisma.modelServiceConfig.findFirst({
        where: {
            userId: context.userId,
            isActive: true,
            isDefault: true,
        },
        orderBy: {
            updatedAt: "desc",
        },
    });

    if (defaultDbConfig) {
        const defaultKey = trimOrEmpty(defaultDbConfig.apiKey);
        if (!defaultKey) {
            return null;
        }

        return {
            endpoint: normalizeOpenAiCompatibleEndpoint(
                mustBeHttpUrl(defaultDbConfig.endpoint, "endpoint"),
            ),
            model: defaultDbConfig.model,
            apiKey: defaultKey,
            source: "database",
        };
    }

    const preset = getPresetById("preset:default-env");
    if (!preset) {
        return null;
    }

    const envKey = trimOrEmpty(process.env[preset.apiKeyEnv ?? ""]);
    if (!envKey) {
        return null;
    }

    return {
        endpoint: normalizeOpenAiCompatibleEndpoint(
            mustBeHttpUrl(preset.endpoint, "endpoint"),
        ),
        model: preset.model,
        apiKey: envKey,
        source: "preset",
    };
}

export async function testModelSelection(
    selection: ModelSelectionInput,
): Promise<ModelServiceTestResult> {
    const config = await resolveModelSelection(selection);
    if (!config) {
        return {
            ok: false,
            latencyMs: 0,
            resolvedModel: "",
            resolvedEndpoint: "",
            preview: "",
            error: "No model config available",
        };
    }

    const startedAt = Date.now();

    try {
        const response = await fetch(config.endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: config.model,
                stream: false,
                max_tokens: 24,
                temperature: 0,
                messages: [{ role: "user", content: "reply with: pong" }],
            }),
        });

        if (!response.ok) {
            const errorText = await readUpstreamError(response);
            logUpstreamHttpError(
                {
                    scope: "model-test",
                    endpoint: config.endpoint,
                    model: config.model,
                    source: config.source,
                },
                errorText,
            );

            return {
                ok: false,
                latencyMs: Date.now() - startedAt,
                resolvedModel: config.model,
                resolvedEndpoint: config.endpoint,
                preview: "",
                error: errorText,
            };
        }

        const json = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
        };
        const preview =
            json.choices?.[0]?.message?.content?.slice(0, 200) ?? "";

        return {
            ok: true,
            latencyMs: Date.now() - startedAt,
            resolvedModel: config.model,
            resolvedEndpoint: config.endpoint,
            preview,
        };
    } catch (err) {
        logUpstreamNetworkError(
            {
                scope: "model-test",
                endpoint: config.endpoint,
                model: config.model,
                source: config.source,
            },
            err,
        );

        return {
            ok: false,
            latencyMs: Date.now() - startedAt,
            resolvedModel: config.model,
            resolvedEndpoint: config.endpoint,
            preview: "",
            error: err instanceof Error ? err.message : "Network error",
        };
    }
}
