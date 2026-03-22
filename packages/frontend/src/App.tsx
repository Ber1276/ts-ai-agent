import "./App.css";
import { useChat } from "./hooks/useChat";

function App() {
    const {
        input,
        setInput,
        messages,
        loading,
        streaming,
        error,
        lastHeartbeatAt,
        canSend,
        sendOnce,
        sendStream,
        stopStream,
    } = useChat();

    return (
        <div className="layout">
            <h1>AI Agent Platform Scaffold</h1>
            <p className="subtitle">
                Chat + SSE streaming skeleton is ready. Complete all TODO blocks
                by hand.
            </p>

            <div className="chat-panel">
                {/* TODO(handwrite): replace this plain list with a virtual list.
                    Required: support 10k+ messages with stable scroll anchoring and dynamic row height measurement.
                */}
                {messages.map((msg) => (
                    <div key={msg.id} className="message">
                        <strong>
                            {msg.role === "user" ? "You" : "Assistant"}:
                        </strong>
                        <pre>{msg.content}</pre>
                    </div>
                ))}
                {loading && <p className="hint">Loading response...</p>}
                {streaming && <p className="hint">Streaming response...</p>}
                {streaming && lastHeartbeatAt && (
                    <p className="hint">
                        Heartbeat:{" "}
                        {new Date(lastHeartbeatAt).toLocaleTimeString()}
                    </p>
                )}
                {error && <p className="error">Error: {error}</p>}
            </div>

            <div className="composer">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendOnce()}
                    placeholder="Enter message"
                    disabled={loading || streaming}
                />
                <button onClick={sendOnce} disabled={!canSend}>
                    Send once
                </button>
                <button onClick={sendStream} disabled={!canSend}>
                    Send stream
                </button>
                <button onClick={stopStream} disabled={!streaming}>
                    Stop stream
                </button>
            </div>
        </div>
    );
}

export default App;
