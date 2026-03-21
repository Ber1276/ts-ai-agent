import { Hono } from "hono";
import { ApiErrorCode, createErrorResponse, createSuccessResponse, MessageRole, } from "share";
function validateMessage(message) {
    if (!message.content || message.content.trim() === "") {
        return { valid: false, error: "Message content cannot be empty" };
    }
    if (!Object.values(MessageRole).includes(message.role)) {
        return { valid: false, error: "Invalid message role" };
    }
    return { valid: true };
}
export const app = new Hono();
app.get("/", (c) => {
    return c.text("Hello Hono!");
});
const route = app.post("/api/chat", async (c) => {
    const req = c.req.json();
    try {
        const payload = await req;
        const message = payload.message;
        const validation = validateMessage(message);
        if (!validation.valid) {
            return c.json(createErrorResponse(ApiErrorCode.INVALID_MESSAGE, validation.error || "Invalid message"), 400);
        }
        return c.json(createSuccessResponse({
            response: "This is a reply from the server.",
        }));
    }
    catch (err) {
        console.error("Error processing request:", err);
        return c.json(createErrorResponse(ApiErrorCode.INTERNAL_ERROR, "An error occurred while processing the request."), 500);
    }
});
