import {
    Bot,
    ChevronRight,
    Trash2,
    MessageSquare,
    Plus,
    Search,
    BrainCircuit,
    ArrowUp,
    Menu,
    Loader2,
    Settings,
    Sparkles
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useChat } from "../hooks/useChat";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import { useState, useEffect, useRef, useMemo } from "react";

/**
 * ChatPage - A simplified, ultra-reliable implementation of the chat interface sidebar.
 * Focuses on concrete width inheritance to prevent horizontal overflow in historical lists.
 */
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
        modelServices,
        selectedServiceId,
        setSelectedServiceId,
        historyRuns,
        setMessages,
        removeHistoryRun,
    } = useChat();

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
    const scrollEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll logic
    useEffect(() => {
        scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void sendMessage();
        }
    };

    // Grouping helper
    const groupedHistory = useMemo(() => {
        const groups: Record<string, any[]> = {
            "今天": [],
            "昨天": [],
            "过去七天": [],
            "更早": []
        };
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        historyRuns.forEach(run => {
            const runDate = new Date(run.startedAt);
            if (runDate >= today) groups["今天"].push(run);
            else if (runDate >= yesterday) groups["昨天"].push(run);
            else if (runDate >= sevenDaysAgo) groups["过去七天"].push(run);
            else groups["更早"].push(run);
        });
        return Object.entries(groups).filter(([_, items]) => items.length > 0);
    }, [historyRuns]);

    return (
        <div className="flex w-full h-full bg-background overflow-hidden font-sans antialiased">
            {/* 
                Bulletproof Sidebar 
                - w-[260px] fixed width with no expansion allowed.
                - overflow-x-hidden for safety.
            */}
            <aside 
                className={cn(
                    "group relative h-full border-r border-border bg-muted/20 flex flex-col shrink-0 transition-all duration-300 ease-in-out z-30",
                    isSidebarOpen ? "w-[260px]" : "w-0 overflow-hidden -translate-x-full"
                )}
            >
                {/* Header */}
                <div className="h-16 w-full flex items-center px-4 shrink-0 border-b border-border/10">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="h-6 w-6 bg-primary rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-primary/20">
                            <Sparkles className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-sm font-black tracking-tight uppercase truncate">Intelligence</span>
                    </div>
                </div>

                {/* New Chat Button Area */}
                <div className="p-3 shrink-0">
                    <Button 
                        onClick={() => {
                            clearChat();
                            setSelectedHistoryId(null);
                        }}
                        className="w-full flex items-center justify-start gap-2 h-11 rounded-xl bg-background border border-border hover:bg-muted text-foreground font-bold shadow-sm"
                    >
                        <Plus className="h-4 w-4 text-primary" strokeWidth={3} />
                        <span className="text-[13px] truncate">开启全新对话</span>
                    </Button>
                </div>

                {/* 
                    Unified History Scroller 
                    - No complicated ScrollArea wrapper to prevent inner calculated widths.
                    - Uses native overflow-y-auto for 100% reliable sizing.
                */}
                <div className="flex-1 w-full overflow-y-auto overflow-x-hidden pt-2 scrollbar-thin scrollbar-thumb-border">
                    <div className="px-2 pb-12 w-full flex flex-col gap-6">
                        {groupedHistory.map(([groupName, items]) => (
                            <div key={groupName} className="flex flex-col w-full">
                                <h4 className="px-3 py-2 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">
                                    {groupName}
                                </h4>
                                <div className="flex flex-col gap-1 w-full">
                                    {items.map((run) => (
                                        <div 
                                            key={run.runId} 
                                            className={cn(
                                                "group/item flex items-center w-full min-w-0 h-10 rounded-lg transition-all duration-200 overflow-hidden",
                                                selectedHistoryId === run.runId ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                                            )}
                                        >
                                            <button
                                                onClick={() => {
                                                    setSelectedHistoryId(run.runId);
                                                    setMessages([
                                                        { id: `u-${run.runId}`, role: "user", content: run.input },
                                                        { id: `a-${run.runId}`, role: "assistant", content: run.outputSummary || "[内容生成中断]" }
                                                    ]);
                                                }}
                                                className="flex-1 flex items-center gap-2 px-3 min-w-0 h-full text-left"
                                            >
                                                <MessageSquare className={cn(
                                                    "h-3.5 w-3.5 shrink-0 transition-opacity",
                                                    selectedHistoryId === run.runId ? "opacity-100" : "opacity-40"
                                                )} />
                                                <span className="flex-1 text-[13px] font-bold truncate leading-none">
                                                    {run.input}
                                                </span>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (confirm("确定要删除此对话吗？")) {
                                                        void removeHistoryRun(run.runId);
                                                        if (selectedHistoryId === run.runId) {
                                                            clearChat();
                                                            setSelectedHistoryId(null);
                                                        }
                                                    }
                                                }}
                                                className="h-7 w-7 mr-1 shrink-0 flex items-center justify-center rounded-md opacity-20 hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all"
                                                title="删除"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Section */}
                <div className="p-4 shrink-0 border-t border-border/10">
                    <div className="flex items-center justify-between px-2">
                        <button className="flex items-center gap-2 text-[10px] font-black text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">
                            <Settings className="h-3.5 w-3.5" />
                            <span>Settings</span>
                        </button>
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-sm" />
                    </div>
                </div>

                {/* Sidebar Collapse Toggle */}
                <button 
                    onClick={() => setIsSidebarOpen(false)}
                    className="absolute -right-3 top-1/2 -translate-y-1/2 h-8 w-6 bg-background border border-border rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-50 hover:bg-muted shadow-sm"
                >
                    <ChevronRight className="h-3 w-3 rotate-180" />
                </button>
            </aside>

            {/* Chat Area */}
            <main className="flex-1 flex flex-col min-w-0 bg-[#FAFAFA] dark:bg-background h-full overflow-hidden relative">
                {!isSidebarOpen && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="fixed left-6 top-6 z-40 h-10 w-10 rounded-2xl shadow-xl border border-border bg-background/80 backdrop-blur-md"
                        onClick={() => setIsSidebarOpen(true)}
                    >
                        <Menu className="h-4 w-4" />
                    </Button>
                )}

                <header className="h-16 flex items-center justify-between px-8 border-b border-border/20 bg-background/50 backdrop-blur-lg shrink-0">
                    <div className="flex flex-col">
                        <h2 className="text-[12px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                            Console
                            <div className="h-1 w-1 rounded-full bg-primary" />
                        </h2>
                        <span className="text-[10px] opacity-40 uppercase font-medium mt-0.5 tracking-widest">RAG Engine Running</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="bg-muted px-4 py-1.5 rounded-xl border border-border flex items-center min-w-[160px]">
                            <select 
                                className="bg-transparent outline-none cursor-pointer text-[11px] font-black w-full appearance-none pr-6 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAyNCAyNCIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cGF0aCBkPSJtNiA5IDYgNiA2LTYiLz48L3N2Zz4=')] bg-[length:1rem] bg-[position:right_center] bg-no-repeat"
                                value={selectedServiceId}
                                onChange={(e) => setSelectedServiceId(e.target.value)}
                            >
                                {modelServices.map((m) => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                ))}
                            </select>
                        </div>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 rounded-xl hover:bg-destructive/10 group"
                            onClick={() => void clearChat()}
                        >
                            <Trash2 className="h-4 w-4 text-muted-foreground group-hover:text-destructive" />
                        </Button>
                    </div>
                </header>

                {/* Message Log */}
                <div className="flex-1 w-full overflow-y-auto scroll-smooth">
                    <div className="max-w-4xl mx-auto py-12 px-6 sm:px-12 space-y-12 pb-40">
                        {messages.length === 0 ? (
                            <div className="py-20 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-700">
                                <div className="h-20 w-20 bg-primary/10 rounded-[2rem] flex items-center justify-center mb-8">
                                    <Bot className="h-10 w-10 text-primary" strokeWidth={1.5} />
                                </div>
                                <h1 className="text-2xl font-black uppercase tracking-tight mb-3">开启智慧对话</h1>
                                <p className="text-sm text-center text-muted-foreground/60 max-w-sm mb-12">
                                    请输入您的问题，我将结合企业知识库为您提供深度精准的解答。
                                </p>
                                <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
                                    {["解析文档核心", "语义搜索增强", "知识库洞察", "自然语言交流"].map((t, i) => (
                                        <Button 
                                            key={i} 
                                            variant="outline" 
                                            className="h-14 rounded-2xl border-border/40 hover:bg-primary/5 hover:border-primary/20 text-[13px] font-bold"
                                            onClick={() => setInput(t)}
                                        >
                                            {t}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-12">
                                {messages.map((message) => (
                                    <div
                                        key={message.id}
                                        className={cn(
                                            "flex flex-col gap-3 animate-in fade-in duration-500",
                                            message.role === "user" ? "items-end" : "items-start"
                                        )}
                                    >
                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/30 px-1">
                                            {message.role === "user" ? "Human" : "Thinknet"}
                                        </span>
                                        <div className={cn(
                                            "max-w-[90%] px-6 py-5 rounded-[2rem] shadow-sm",
                                            message.role === "user" 
                                                ? "bg-primary text-white rounded-tr-lg" 
                                                : "bg-white dark:bg-zinc-900 border border-border/80 rounded-tl-lg"
                                        )}>
                                            {message.metadata?.thinking && (
                                                <div className="mb-6 bg-muted/30 rounded-3xl p-5 border border-dashed border-border/50 text-[13px] text-muted-foreground italic space-y-3">
                                                    <div className="flex items-center gap-2 mb-3 opacity-50">
                                                        <BrainCircuit className="h-4 w-4 animate-pulse text-primary" />
                                                        <span className="text-[9px] font-black uppercase tracking-widest text-primary/80">Thought Pipeline</span>
                                                    </div>
                                                    <div className="opacity-80 leading-relaxed font-mono text-[12px]">
                                                        {message.metadata.thinking}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="prose prose-sm dark:prose-invert max-w-none text-[15px] font-medium leading-relaxed break-words opacity-95">
                                                <ReactMarkdown>{message.content || (message.metadata?.thinking ? "..." : "")}</ReactMarkdown>
                                            </div>
                                            {message.metadata?.sourceDocuments && message.metadata.sourceDocuments.length > 0 && (
                                                <div className="mt-8 pt-6 border-t border-border/10">
                                                    <div className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em] mb-4">
                                                        <Search className="h-3 w-3" />
                                                        Knowledge Citations
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {(() => {
                                                            const docMap = new Map<string, { title: string; count: number; maxScore: number }>();
                                                            for (const doc of message.metadata.sourceDocuments!) {
                                                                const key = doc.id || doc.title;
                                                                const existing = docMap.get(key);
                                                                if (existing) {
                                                                    existing.count += 1;
                                                                    existing.maxScore = Math.max(existing.maxScore, doc.score || 0);
                                                                } else {
                                                                    docMap.set(key, { title: doc.title, count: 1, maxScore: doc.score || 0 });
                                                                }
                                                            }
                                                            return Array.from(docMap.values())
                                                                .sort((a, b) => b.maxScore - a.maxScore)
                                                                .map((doc, idx) => (
                                                                    <div
                                                                        key={idx}
                                                                        className="bg-muted/40 border border-border/40 rounded-full px-4 py-1.5 flex items-center gap-2.5 hover:bg-muted transition-colors cursor-help group/source"
                                                                        title={`相关度: ${(doc.maxScore * 100).toFixed(1)}%`}
                                                                    >
                                                                        <span className="text-[10px] font-bold text-primary">{idx + 1}</span>
                                                                        <span className="text-[11px] font-bold text-muted-foreground group-hover/source:text-foreground transition-colors truncate max-w-[140px]">
                                                                            {doc.title}
                                                                        </span>
                                                                        {doc.count > 1 && (
                                                                            <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded-md text-[9px] font-black">
                                                                                {doc.count}x
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                ));
                                                        })()}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {isThinking && !messages.some(m => m.id.startsWith('a-stream') && m.content) && (
                                    <div className="flex items-center gap-1.5 px-4 opacity-40">
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" />
                                    </div>
                                )}
                                <div ref={scrollEndRef} className="h-40" />
                            </div>
                        )}
                    </div>
                </div>

                {/* Input Area */}
                <div className="absolute bottom-10 left-0 right-0 px-6 sm:px-12 z-20">
                    <div className="max-w-4xl mx-auto relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-blue-500/10 blur-2xl rounded-[3rem] opacity-0 group-focus-within:opacity-100 transition-opacity duration-1000" />
                        <div className="relative bg-white dark:bg-zinc-900 border border-border shadow-2xl rounded-[2.5rem] p-3 flex items-center gap-2 ring-1 ring-border/20">
                            <textarea
                                value={input}
                                onChange={(e) => { setInput(e.target.value); if (error) clearError(); }}
                                onKeyDown={handleKeyDown}
                                placeholder="输入消息..."
                                className="flex-1 bg-transparent px-6 py-4 outline-none text-[15px] font-medium resize-none max-h-40 min-h-[56px] leading-relaxed"
                                rows={1}
                                disabled={isThinking}
                            />
                            <Button
                                onClick={() => void sendMessage()}
                                disabled={!input.trim() || isThinking}
                                className={cn(
                                    "h-12 w-12 rounded-full p-0 shrink-0",
                                    input.trim() ? "bg-primary text-white" : "bg-muted text-muted-foreground/20"
                                )}
                            >
                                {isThinking ? <Loader2 className="animate-spin h-5 w-5" /> : <ArrowUp className="h-5 w-5" strokeWidth={3} />}
                            </Button>
                        </div>
                        {error && <div className="mt-4 text-center text-[11px] font-bold text-red-500 uppercase tracking-widest">{error}</div>}
                    </div>
                </div>
            </main>
        </div>
    );
}
