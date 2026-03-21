import "./App.css";
import { useState } from "react";
import { fetchChatResponse } from "./api/chatApi";
import { useApi } from "./hooks/useApi";

function App() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<
        Array<{ role: "user" | "assistant"; content: string }>
    >([]);
    const { loading, error } = useApi<{ response: string }>();

    const handleSend = async () => {
        if (!input.trim()) return;

        // 添加用户消息
        setMessages((prev) => [...prev, { role: "user", content: input }]);
        setInput("");

        try {
            const response = await fetchChatResponse(input);
            // 添加助手回复
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: response },
            ]);
        } catch (err) {
            const errorMsg =
                err instanceof Error ? err.message : "Failed to fetch response";
            setMessages((prev) => [
                ...prev,
                { role: "assistant", content: `Error: ${errorMsg}` },
            ]);
        }
    };

    return (
        <div style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
            <h1>AI Chat Platform</h1>

            <div
                style={{
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    padding: "15px",
                    height: "400px",
                    overflowY: "auto",
                    marginBottom: "15px",
                    backgroundColor: "#f9f9f9",
                }}
            >
                {messages.map((msg, idx) => (
                    <div key={idx} style={{ marginBottom: "10px" }}>
                        <strong>
                            {msg.role === "user" ? "You" : "Assistant"}:
                        </strong>
                        <p style={{ margin: "5px 0 0 0" }}>{msg.content}</p>
                    </div>
                ))}
                {loading && <p style={{ color: "#999" }}>Loading...</p>}
                {error && <p style={{ color: "red" }}>Error: {error}</p>}
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSend()}
                    placeholder="Enter message..."
                    disabled={loading}
                    style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: "4px",
                        border: "1px solid #ccc",
                    }}
                />
                <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    style={{
                        padding: "10px 20px",
                        borderRadius: "4px",
                        border: "none",
                        backgroundColor: "#007bff",
                        color: "white",
                        cursor: "pointer",
                        opacity: loading || !input.trim() ? 0.5 : 1,
                    }}
                >
                    Send
                </button>
            </div>
        </div>
    );
}

export default App;
