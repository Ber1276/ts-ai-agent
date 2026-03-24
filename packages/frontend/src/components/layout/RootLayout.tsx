import { useLocation, Link, Outlet } from "react-router-dom";
import { Bot, Database, Sparkles } from "lucide-react";
import { cn } from "../../lib/utils";

const menuItems = [
    { icon: Sparkles, label: "对话空间", path: "/" },
    { icon: Bot, label: "模型管理", path: "/models" },
    { icon: Database, label: "知识库管理", path: "/knowledge" },
];

export function RootLayout() {
    const location = useLocation();

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
            <aside className="w-64 border-r border-border bg-card flex flex-col shrink-0">
                <div className="p-6 border-b border-border space-y-1">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                            <Sparkles className="h-5 w-5 text-primary-foreground" />
                        </div>
                        <h1 className="font-bold text-lg tracking-tight">
                            RAG Pro
                        </h1>
                    </div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                        Enterprise Console
                    </p>
                </div>

                <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all group",
                                    isActive
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                )}
                            >
                                <div className="flex items-center gap-3">
                                    <Icon
                                        className={cn(
                                            "h-4 w-4",
                                            isActive
                                                ? "text-primary-foreground"
                                                : "text-muted-foreground group-hover:text-foreground",
                                        )}
                                    />
                                    <span className="font-medium">
                                        {item.label}
                                    </span>
                                </div>
                                {isActive && (
                                    <div className="h-1 w-1 rounded-full bg-primary-foreground" />
                                )}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-border">
                    <div className="px-3 py-3 rounded-xl bg-muted/50 border border-border/50 text-[10px] space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                                Version
                            </span>
                            <span className="font-mono">v1.2.0-stable</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                                Status
                            </span>
                            <div className="flex items-center gap-1.5 font-medium text-emerald-600">
                                <div className="h-1 w-1 rounded-full bg-emerald-600 animate-pulse" />
                                Online
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col relative min-w-0 bg-[#fafafa]">
                <Outlet />
            </main>
        </div>
    );
}
