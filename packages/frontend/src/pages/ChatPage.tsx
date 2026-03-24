import {
    Bot,
    Send,
    Loader2,
    User,
    ChevronRight,
    Wand2,
    Hash,
    Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useChat } from "../hooks/useChat";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { ScrollArea } from "../components/ui/scroll-area";
import { Badge } from "../components/ui/badge";

export function ChatPage() {
    const {
        messages,
        input,
        setInput,
        sendMessage,
        clearChat,
        error,
        clearError,
        isThinking,
        ragStrategy,
        activeModel,
    } = useChat();

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void sendMessage();
        }
    };

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-[#F9FBFC]">
            <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6 shrink-0 relative z-10">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/5 p-2 rounded-lg ring-1 ring-primary/10">
                        <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex flex-col">
                        <h2 className="text-sm font-bold leading-none mb-1">
                            AI 智能对话助手
                        </h2>
                        <div className="flex items-center gap-2 group cursor-pointer transition-opacity hover:opacity-80">
                            <Badge
                                variant="secondary"
                                className="px-2 py-0 text-[10px] font-mono text-muted-foreground uppercase tracking-widest bg-muted h-5 shrink-0"
                            >
                                {activeModel?.name || "GLOBAL AI"}
                            </Badge>
                            <ChevronRight className="h-3 w-3 text-muted-foreground opacity-50" />
                            <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[150px]">
                                {activeModel?.id || "未配置模型"}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void clearChat()}
                        className="h-9 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        清空对话
                    </Button>
                    <div className="h-4 w-[1px] bg-border/50" />
                    <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/40">
                        <span className="relative flex h-2 w-2">
                            <span
                                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isThinking ? "bg-orange-400" : "bg-green-400"}`}
                            ></span>
                            <span
                                className={`relative inline-flex rounded-full h-2 w-2 ${isThinking ? "bg-orange-500" : "bg-green-500"}`}
                            ></span>
                        </span>
                        {isThinking ? "AI 正在思考" : "模型就绪"}
                    </div>
                </div>
            </header>

            <ScrollArea className="flex-1 px-6 min-h-0">
                <div className="max-w-4xl mx-auto py-12 space-y-10">
                    {messages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-700">
                            <div className="relative">
                                <div className="absolute -inset-4 bg-primary/20 blur-2xl rounded-full opacity-30 animate-pulse" />
                                <Bot
                                    className="h-20 w-20 text-primary relative"
                                    strokeWidth={1.5}
                                />
                            </div>
                            <div className="text-center space-y-3">
                                <h3 className="text-2xl font-bold tracking-tight">
                                    您好，我是您的 AI 助手
                                </h3>
                                <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                                    今天我可以帮您做些什么？您可以尝试问我关于知识库中的内容，或者直接开始对话。
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-3 w-full max-w-lg pt-4">
                                {[
                                    "总结上传的文档",
                                    "分析系统架构",
                                    "编写代码逻辑",
                                    "通用语言助手",
                                ].map((tip, idx) => (
                                    <button
                                        key={idx}
                                        className="flex items-center justify-between p-4 bg-card border border-border rounded-xl text-left hover:border-primary/50 hover:shadow-sm transition-all group"
                                    >
                                        <span className="text-sm font-medium">
                                            {tip}
                                        </span>
                                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex items-start gap-5 group animate-in slide-in-from-bottom-2 duration-300 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                            >
                                <div
                                    className={`mt-1 h-10 w-10 shrink-0 rounded-2xl flex items-center justify-center border shadow-sm transition-all ${
                                        message.role === "user"
                                            ? "bg-primary border-primary text-primary-foreground"
                                            : "bg-white border-border"
                                    }`}
                                >
                                    {message.role === "user" ? (
                                        <User className="h-5 w-5" />
                                    ) : (
                                        <Bot className="h-5 w-5 text-primary" />
                                    )}
                                </div>
                                <div
                                    className={`flex flex-col max-w-[85%] space-y-2 ${message.role === "user" ? "items-end" : ""}`}
                                >
                                    <div className="flex items-center gap-3 px-1">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60">
                                            {message.role === "user"
                                                ? "You"
                                                : "Assistant"}
                                        </span>
                                        {message.role === "assistant" &&
                                            message.metadata?.rag && (
                                                <div className="flex items-center gap-1.5 cursor-default">
                                                    <Badge
                                                        variant="outline"
                                                        className="h-4 px-1.5 text-[9px] font-mono border-blue-200 bg-blue-50/50 text-blue-700 hover:bg-blue-100 transition-colors uppercase"
                                                    >
                                                        <Hash className="h-2 w-2 mr-1" />
                                                        RAG Boosted
                                                    </Badge>
                                                </div>
                                            )}
                                    </div>
                                    {message.role === "assistant" &&
                                    message.metadata?.thinking ? (
                                        <details className="w-full rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 shadow-sm">
                                            <summary className="cursor-pointer list-none font-semibold uppercase tracking-wide text-[10px] text-amber-700 select-none">
                                                思考过程（点击展开）
                                            </summary>
                                            <div className="mt-2 whitespace-pre-wrap leading-relaxed opacity-90">
                                                {message.metadata.thinking}
                                            </div>
                                        </details>
                                    ) : null}
                                    <div
                                        className={`px-5 py-4 rounded-3xl shadow-sm text-sm leading-relaxed border transition-shadow hover:shadow-md ${
                                            message.role === "user"
                                                ? "bg-primary text-primary-foreground border-primary rounded-tr-none"
                                                : "bg-white text-foreground border-border rounded-tl-none"
                                        }`}
                                    >
                                        <div className="prose prose-slate max-w-none dark:prose-invert break-words">
                                            <ReactMarkdown>
                                                {message.content}
                                            </ReactMarkdown>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>

            <footer className="p-6 bg-[#F9FBFC]/80 backdrop-blur-md border-t border-border shrink-0">
                <div className="max-w-4xl mx-auto space-y-4">
                    <div className="flex items-center gap-3 px-1 overflow-x-auto whitespace-nowrap scrollbar-hide no-scrollbar h-6">
                        {ragStrategy?.reason && (
                            <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border border-border/50 shrink-0">
                                <Wand2 className="h-3 w-3 text-primary/70" />
                                <span>策略建议：{ragStrategy.reason}</span>
                            </div>
                        )}
                    </div>
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-blue-400/10 blur opacity-40 group-focus-within:opacity-100 transition-opacity duration-500" />
                        <div className="relative bg-card border border-border rounded-[2rem] p-3 shadow-sm group-focus-within:border-primary/40 group-focus-within:shadow-lg transition-all">
                            <div className="flex items-center gap-3">
                                <Input
                                    value={input}
                                    onChange={(e) => {
                                        setInput(e.target.value);
                                        if (error) {
                                            clearError();
                                        }
                                    }}
                                    onKeyDown={handleKeyDown}
                                    placeholder="输入问题或任务指令..."
                                    className="flex-1 bg-transparent border-none focus-visible:ring-0 text-base py-6 h-12"
                                    disabled={isThinking}
                                />
                                <Button
                                    onClick={() => void sendMessage()}
                                    disabled={!input.trim() || isThinking}
                                    className="h-12 w-12 rounded-full p-0 shrink-0 shadow-lg shadow-primary/20 hover:scale-105 transition-transform active:scale-95 disabled:scale-100"
                                >
                                    {isThinking ? (
                                        <Loader2 className="h-6 w-6 animate-spin" />
                                    ) : (
                                        <Send className="h-5 w-5" />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                    {error ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                            {error}
                        </div>
                    ) : null}
                    <p className="text-[10px] text-center text-muted-foreground/60 uppercase tracking-widest font-medium">
                        AI Assistant powered by RAG Engine •{" "}
                        {activeModel?.provider || "UNSPECIFIED"}
                    </p>
                </div>
            </footer>
        </div>
    );
}
