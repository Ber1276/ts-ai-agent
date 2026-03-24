import { serve } from "@hono/node-server";
import { app } from "./app.js";

const parsedPort = Number(process.env.PORT ?? "3000");
const port = Number.isFinite(parsedPort) ? parsedPort : 3000;

serve(
    {
        fetch: app.fetch,
        port,
    },
    (info) => {
        console.log(`Server is running on http://localhost:${info.port}`);
    },
);
