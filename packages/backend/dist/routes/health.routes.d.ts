export declare const healthRoutes: import("hono/hono-base").HonoBase<import("hono/types").BlankEnv, {
    "/health": {
        $get: {
            input: {};
            output: {
                success: boolean;
                data?: {
                    status: string;
                    time: string;
                } | undefined;
                error?: {
                    code: import("share").ApiErrorCodeType;
                    message: string;
                    details?: {
                        [x: string]: import("hono/utils/types").JSONValue;
                    } | undefined;
                } | undefined;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        };
    };
}, "/", "/health">;
//# sourceMappingURL=health.routes.d.ts.map