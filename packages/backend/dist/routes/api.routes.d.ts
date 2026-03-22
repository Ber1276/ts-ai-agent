export declare const apiRoutes: import("hono/hono-base").HonoBase<import("hono/types").BlankEnv, import("hono/types").BlankSchema | import("hono/types").MergeSchemaPath<{
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
}, "/"> | import("hono/types").MergeSchemaPath<{
    "/": {
        $post: {
            input: {};
            output: {
                success: boolean;
                data?: {
                    response: string;
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
} & {
    "/stream/cancel": {
        $post: {
            input: {};
            output: {
                success: boolean;
                data?: {
                    runId: string;
                    canceled: boolean;
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
} & {
    "/stream": {
        $get: {
            input: {};
            output: {};
            outputFormat: string;
            status: import("hono/utils/http-status").StatusCode;
        };
    };
}, "/chat">, "/", "/">;
//# sourceMappingURL=api.routes.d.ts.map