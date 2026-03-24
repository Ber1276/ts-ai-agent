import type { ResolvedModelConfig } from "./model-service.js";

export interface UpstreamErrorContext {
    scope: "model-test" | "chat-once" | "chat-stream";
    endpoint: string;
    model: string;
    source: ResolvedModelConfig["source"];
}

function toSafeEndpoint(endpoint: string): string {
    try {
        const parsed = new URL(endpoint);
        return `${parsed.origin}${parsed.pathname}`;
    } catch {
        return endpoint;
    }
}

function pickHeader(response: Response, key: string): string | undefined {
    const value = response.headers.get(key);
    if (!value) {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
}

function getEndpointHint(
    context: UpstreamErrorContext,
    errorText: string,
): string | undefined {
    if (!errorText.startsWith("HTTP 404")) {
        return undefined;
    }

    try {
        const url = new URL(context.endpoint);
        const path = url.pathname.replace(/\/+$/, "");
        if (path === "/v1" || path === "" || path === "/compatible-mode/v1") {
            return "Possible wrong endpoint path for OpenAI-compatible API. Try /v1/chat/completions.";
        }
    } catch {
        return undefined;
    }

    return undefined;
}

export async function readUpstreamError(response: Response): Promise<string> {
    const retryAfter = pickHeader(response, "retry-after");
    const contentType = pickHeader(response, "content-type") ?? "";
    const requestId =
        pickHeader(response, "x-request-id") ??
        pickHeader(response, "request-id") ??
        pickHeader(response, "x-trace-id") ??
        pickHeader(response, "trace-id");
    const server = pickHeader(response, "server");

    let rawBody = "";
    let detail = "";

    try {
        rawBody = await response.text();
    } catch {
        rawBody = "";
    }

    if (rawBody) {
        try {
            const parsed = JSON.parse(rawBody) as {
                error?: {
                    message?: string;
                    code?: string | number;
                    type?: string;
                };
                message?: string;
                code?: string | number;
            };

            const parts = [
                parsed.error?.message,
                parsed.message,
                parsed.error?.type,
                parsed.error?.code !== undefined
                    ? String(parsed.error.code)
                    : undefined,
                parsed.code !== undefined ? String(parsed.code) : undefined,
            ].filter((item): item is string => Boolean(item && item.trim()));

            detail = parts.join(" | ");
        } catch {
            detail = rawBody.trim();
        }
    }

    if (!detail && contentType && !contentType.includes("application/json")) {
        detail = rawBody.trim();
    }

    if (!detail) {
        detail = "Empty upstream response body";
    }

    if (detail.length > 500) {
        detail = `${detail.slice(0, 500)}...`;
    }

    const parts = [`HTTP ${response.status}`];
    if (retryAfter) {
        parts.push(`retry-after: ${retryAfter}`);
    }
    if (requestId) {
        parts.push(`request-id: ${requestId}`);
    }
    if (server) {
        parts.push(`server: ${server}`);
    }
    parts.push(detail);

    return parts.join(" | ");
}

export function logUpstreamHttpError(
    context: UpstreamErrorContext,
    errorText: string,
): void {
    const hint = getEndpointHint(context, errorText);
    console.error("[model-provider-error]", {
        scope: context.scope,
        source: context.source,
        model: context.model,
        endpoint: toSafeEndpoint(context.endpoint),
        error: errorText,
        hint,
    });
}

export function logUpstreamNetworkError(
    context: UpstreamErrorContext,
    err: unknown,
): void {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[model-provider-network-error]", {
        scope: context.scope,
        source: context.source,
        model: context.model,
        endpoint: toSafeEndpoint(context.endpoint),
        error: message,
    });
}
