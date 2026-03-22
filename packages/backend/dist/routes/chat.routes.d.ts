export declare const chatRoutes: import("hono/hono-base").HonoBase<import("hono/types").BlankEnv, {
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
}, "/", "/stream">;
//# sourceMappingURL=chat.routes.d.ts.map