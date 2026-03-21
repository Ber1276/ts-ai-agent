import { Hono } from "hono";
export declare const app: Hono<import("hono/types").BlankEnv, import("hono/types").BlankSchema, "/">;
declare const route: import("hono/hono-base").HonoBase<import("hono/types").BlankEnv, {
    "/api/chat": {
        $post: {
            input: {};
            output: {
                success: boolean;
                error?: {
                    code: string;
                    message: string;
                } | undefined;
            };
            outputFormat: "json";
            status: 400;
        } | {
            input: {};
            output: {
                success: boolean;
                data?: {
                    response: string;
                } | undefined;
                error?: {
                    code: string;
                    message: string;
                } | undefined;
            };
            outputFormat: "json";
            status: import("hono/utils/http-status").ContentfulStatusCode;
        } | {
            input: {};
            output: {
                success: boolean;
                error?: {
                    code: string;
                    message: string;
                } | undefined;
            };
            outputFormat: "json";
            status: 500;
        };
    };
}, "/", "/api/chat">;
export type AppType = typeof route;
export {};
//# sourceMappingURL=app.d.ts.map