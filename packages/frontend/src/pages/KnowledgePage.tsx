import {
    Database,
    Loader2,
    RefreshCw,
    Upload,
    AlertCircle,
    FileText,
    Hash,
} from "lucide-react";
import type { ChangeEvent } from "react";
import { useChat } from "../hooks/useChat";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Badge } from "../components/ui/badge";

export function KnowledgePage() {
    const {
        ragStrategy,
        indexedDocuments,
        uploadingRag,
        ragTitle,
        setRagTitle,
        ragContent,
        setRagContent,
        refreshRagOverview,
        uploadRagFromText,
        uploadRagFromFile,
    } = useChat();

    const onPickFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        await uploadRagFromFile(file);
        event.target.value = "";
    };

    return (
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            <header className="mb-8 flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                        <Database className="h-8 w-8 text-primary" />
                        知识库管理
                    </h1>
                    <p className="text-muted-foreground max-w-lg">
                        管理用于检索增强生成的 RAG
                        索引。您可以上传文件或直接粘贴文本，系统将自动进行分块并向量化存储。
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refreshRagOverview()}
                    className="flex items-center gap-2"
                >
                    <RefreshCw className="h-4 w-4" />
                    刷新策略
                </Button>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_400px] gap-8">
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-xl p-8 shadow-sm space-y-8 min-h-[500px]">
                        <div className="space-y-6 pb-6 border-b border-border">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Upload className="h-5 w-5 text-primary" />
                                数据摄取
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <label className="text-sm font-semibold">
                                        手动导入
                                    </label>
                                    <Input
                                        value={ragTitle}
                                        onChange={(e) =>
                                            setRagTitle(e.target.value)
                                        }
                                        placeholder="文档标题（可选）"
                                    />
                                    <Textarea
                                        value={ragContent}
                                        onChange={(e) =>
                                            setRagContent(e.target.value)
                                        }
                                        placeholder="输入或粘贴知识文档内容，点击右侧上传按钮进行分块索引..."
                                        className="min-h-32 text-xs"
                                    />
                                    <Button
                                        onClick={() => void uploadRagFromText()}
                                        disabled={uploadingRag}
                                        className="w-full"
                                    >
                                        {uploadingRag ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : (
                                            <Upload className="h-4 w-4 mr-2" />
                                        )}
                                        上传文本内容
                                    </Button>
                                </div>

                                <div className="flex flex-col gap-4">
                                    <label className="text-sm font-semibold">
                                        文件上传
                                    </label>
                                    <div className="flex-1 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-6 hover:bg-muted/30 transition-all cursor-pointer relative">
                                        <input
                                            type="file"
                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                            onChange={onPickFile}
                                        />
                                        <div className="flex flex-col items-center gap-4 text-center">
                                            <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                                                <FileText className="h-6 w-6 text-primary opacity-60" />
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-sm font-semibold">
                                                    拖拽或点击上传
                                                </p>
                                                <p className="text-xs text-muted-foreground px-4">
                                                    支持 .pdf, .docx, .txt
                                                    等主流格式
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5 text-primary" />
                                当前已存索引
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {indexedDocuments.length === 0 ? (
                                    <div className="col-span-full py-12 flex flex-col items-center justify-center border border-dashed border-border rounded-xl bg-muted/20 text-muted-foreground italic text-sm">
                                        暂无已索引的文档数据。
                                    </div>
                                ) : (
                                    indexedDocuments.map((doc, idx) => (
                                        <div
                                            key={idx}
                                            className="flex flex-col gap-4 p-5 rounded-xl bg-card border border-border/70 hover:shadow-md transition-all group overflow-hidden relative"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <FileText className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                                                    <span className="text-sm font-bold truncate max-w-[150px]">
                                                        {doc.title}
                                                    </span>
                                                </div>
                                                <Badge
                                                    variant="secondary"
                                                    className="px-2 font-mono text-[10px] tabular-nums shrink-0"
                                                >
                                                    {doc.chunkCount} Chunks
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-4 text-[11px] text-muted-foreground pb-2 h-4 overflow-hidden">
                                                <span>Type: Markdown</span>
                                                <span>
                                                    ID: chunk-
                                                    {(idx + 1)
                                                        .toString()
                                                        .padStart(3, "0")}
                                                </span>
                                            </div>
                                            <div className="absolute top-1/2 -translate-y-1/2 -right-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                <Hash className="h-20 w-20 rotate-12" />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-6 shrink-0">
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm overflow-hidden relative">
                        <h3 className="font-bold mb-4 flex items-center gap-2 underline decoration-primary decoration-4 underline-offset-4">
                            RAG 检索策略
                        </h3>
                        <div className="space-y-4 text-sm pt-2">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between font-mono bg-muted/60 p-2 rounded-md border border-border/40 text-[13px] text-primary font-bold tracking-tight">
                                    <span>
                                        {ragStrategy?.mode?.toUpperCase() ||
                                            "KEYWORD"}{" "}
                                        MODE
                                    </span>
                                    {ragStrategy?.shouldUseVectorDb ? (
                                        <Badge variant="destructive">
                                            Vector
                                        </Badge>
                                    ) : (
                                        <Badge variant="success">Classic</Badge>
                                    )}
                                </div>
                                <p className="text-[13px] leading-relaxed text-muted-foreground border-l-2 border-primary/20 pl-4 py-1 italic">
                                    "
                                    {ragStrategy?.reason ||
                                        "系统正在选择最优检索路径..."}
                                    "
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 rounded-xl border border-blue-200 bg-blue-50 text-[13px] text-blue-800 space-y-3">
                        <div className="flex items-center gap-2 font-bold">
                            <AlertCircle className="h-4 w-4" />
                            <span>知识库提示</span>
                        </div>
                        <p className="leading-relaxed opacity-90 leading-6">
                            系统会自动根据每个文档的大小动态进行分块。目前分段策略为：`Separator='\n\n',
                            ChunkSize=1000, Overlap=100`。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
