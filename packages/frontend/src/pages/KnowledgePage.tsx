import {
    AlertCircle,
    Database,
    FileText,
    Hash,
    Loader2,
    RefreshCw,
    Save,
    Upload,
    Play
} from "lucide-react";
import { useCallback, useMemo, useState, type ChangeEvent } from "react";
import type { RagConfigUpdateInput } from "share";
import { useChat } from "../hooks/useChat";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { testRagEmbeddingConfig } from "../api/chatApi";

interface RagConfigDraft {
    retrieverMode: "keyword" | "vector" | "hybrid";
    vectorStore: "database" | "memory" | "pgvector";
    chunkSize: string;
    chunkOverlap: string;
    topK: string;
    minScore: string;
    embeddingEndpoint: string;
    embeddingModel: string;
    embeddingApiKey: string;
    embeddingDimensions: string;
}

const defaultDraft: RagConfigDraft = {
    retrieverMode: "keyword",
    vectorStore: "database",
    chunkSize: "1000",
    chunkOverlap: "120",
    topK: "6",
    minScore: "0.2",
    embeddingEndpoint: "",
    embeddingModel: "",
    embeddingApiKey: "",
    embeddingDimensions: "1536",
};

function toInt(input: string, fallback: number): number {
    const parsed = Number.parseInt(input, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toFloat(input: string, fallback: number): number {
    const parsed = Number.parseFloat(input);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function KnowledgePage() {
    const {
        ragStrategy,
        ragConfig,
        indexedDocuments,
        loadingRag,
        savingRagConfig,
        uploadingRag,
        ragUploadMessage,
        ragTitle,
        setRagTitle,
        ragContent,
        setRagContent,
        refreshRagOverview,
        persistRagConfig,
        uploadRagFromText,
        uploadRagFromFile,
        error,
        clearError,
    } = useChat({ loadModelServices: false });

    const [draft, setDraft] = useState<RagConfigDraft | null>(null);
    const [testingConnection, setTestingConnection] = useState(false);
    const [testSuccessMessage, setTestSuccessMessage] = useState<string | null>(null);

    const baseDraft = useMemo<RagConfigDraft>(() => {
        if (!ragConfig) {
            return defaultDraft;
        }

        return {
            retrieverMode: ragConfig.retrieverMode,
            vectorStore: ragConfig.vectorStore,
            chunkSize: String(ragConfig.chunkSize),
            chunkOverlap: String(ragConfig.chunkOverlap),
            topK: String(ragConfig.topK),
            minScore: String(ragConfig.minScore),
            embeddingEndpoint: ragConfig.embeddingEndpoint,
            embeddingModel: ragConfig.embeddingModel,
            embeddingApiKey: "",
            embeddingDimensions: String(ragConfig.embeddingDimensions),
        };
    }, [ragConfig]);

    const effectiveDraft = draft ?? baseDraft;

    const patchDraft = useCallback(
        (patch: Partial<RagConfigDraft>) => {
            setDraft((prev) => ({
                ...(prev ?? baseDraft),
                ...patch,
            }));
        },
        [baseDraft],
    );

    const onPickFile = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        await uploadRagFromFile(file);
        event.target.value = "";
    };

    const onSaveConfig = async () => {
        setTestSuccessMessage(null);
        const payload: RagConfigUpdateInput = {
            retrieverMode: effectiveDraft.retrieverMode,
            vectorStore: effectiveDraft.vectorStore,
            chunkSize: toInt(effectiveDraft.chunkSize, 1000),
            chunkOverlap: toInt(effectiveDraft.chunkOverlap, 120),
            topK: toInt(effectiveDraft.topK, 6),
            minScore: toFloat(effectiveDraft.minScore, 0.2),
            embeddingEndpoint: effectiveDraft.embeddingEndpoint.trim(),
            embeddingModel: effectiveDraft.embeddingModel.trim(),
            embeddingDimensions: toInt(effectiveDraft.embeddingDimensions, 1536),
            ...(effectiveDraft.embeddingApiKey.trim()
                ? { embeddingApiKey: effectiveDraft.embeddingApiKey.trim() }
                : {}),
        };

        await persistRagConfig(payload);
        setDraft(null);
    };

    const onTestConnection = async () => {
        setTestSuccessMessage(null);
        clearError();
        setTestingConnection(true);
        const payload: RagConfigUpdateInput = {
            embeddingEndpoint: effectiveDraft.embeddingEndpoint.trim(),
            embeddingModel: effectiveDraft.embeddingModel.trim(),
            embeddingDimensions: toInt(effectiveDraft.embeddingDimensions, 1536),
            ...(effectiveDraft.embeddingApiKey.trim()
                ? { embeddingApiKey: effectiveDraft.embeddingApiKey.trim() }
                : {}),
        };

        try {
            const res = await testRagEmbeddingConfig(payload);
            setTestSuccessMessage(`测试成功！向量维度: ${res.vectorSize}`);
        } catch (err) {
            setTestSuccessMessage(null);
            // Show error in local testError if possible, but actually we can just manually trigger a browser alert or throw it so it gets printed if we want to.
            // Wait, we can reuse `error` from `useChat` but we can't because it's a read-only variable from the hook. To display the error on the page we can just add a simple `setLocalError` hook inside `KnowledgePage`. Since I just created `setTestSuccessMessage`, I can repurpose it as an error by combining it into the global error or just logging it inside a `Toast`.
            const msg = err instanceof Error ? err.message : "测试连接失败";
            alert(`测试连接失败: ${msg}`);
        } finally {
            setTestingConnection(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                        <Database className="h-8 w-8 text-primary" />
                        知识库管理
                    </h1>
                    <p className="text-muted-foreground max-w-2xl">
                        上传文档后系统自动切片。可配置 Embedding 模型与向量存储，实现 Keyword / Vector / Hybrid 检索。
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refreshRagOverview()}
                    className="flex items-center gap-2"
                    disabled={loadingRag}
                >
                    {loadingRag ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <RefreshCw className="h-4 w-4" />
                    )}
                    刷新
                </Button>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-8">
                <div className="space-y-6">
                    {error ? (
                        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700 flex justify-between items-start">
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                <span>{error}</span>
                            </div>
                            <Button variant="ghost" size="sm" onClick={clearError} className="h-6 w-6 p-0 hover:bg-red-100/50">×</Button>
                        </div>
                    ) : null}

                    <section className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-5">
                        <h3 className="font-bold text-lg">RAG 与 Embedding 配置</h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    检索模式
                                </label>
                                <select
                                    value={effectiveDraft.retrieverMode}
                                    onChange={(e) =>
                                        patchDraft({
                                            retrieverMode: e.target
                                                .value as RagConfigDraft["retrieverMode"],
                                        })
                                    }
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="keyword">Keyword</option>
                                    <option value="vector">Vector</option>
                                    <option value="hybrid">Hybrid</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    向量存储
                                </label>
                                <select
                                    value={effectiveDraft.vectorStore}
                                    onChange={(e) =>
                                        patchDraft({
                                            vectorStore: e.target
                                                .value as RagConfigDraft["vectorStore"],
                                        })
                                    }
                                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                                >
                                    <option value="database">Database</option>
                                    <option value="memory">Memory</option>
                                    <option value="pgvector">PGVector</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold">Chunk Size</label>
                                <Input
                                    value={effectiveDraft.chunkSize}
                                    onChange={(e) =>
                                        patchDraft({ chunkSize: e.target.value })
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold">Chunk Overlap</label>
                                <Input
                                    value={effectiveDraft.chunkOverlap}
                                    onChange={(e) =>
                                        patchDraft({ chunkOverlap: e.target.value })
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold">Top K</label>
                                <Input
                                    value={effectiveDraft.topK}
                                    onChange={(e) =>
                                        patchDraft({ topK: e.target.value })
                                    }
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold">Min Score</label>
                                <Input
                                    value={effectiveDraft.minScore}
                                    onChange={(e) =>
                                        patchDraft({ minScore: e.target.value })
                                    }
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-semibold">Embedding Endpoint</label>
                                <Input
                                    value={effectiveDraft.embeddingEndpoint}
                                    onChange={(e) =>
                                        patchDraft({
                                            embeddingEndpoint: e.target.value,
                                        })
                                    }
                                    placeholder="https://api.openai.com/v1/embeddings"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold">Embedding Model</label>
                                <Input
                                    value={effectiveDraft.embeddingModel}
                                    onChange={(e) =>
                                        patchDraft({
                                            embeddingModel: e.target.value,
                                        })
                                    }
                                    placeholder="text-embedding-3-small"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-semibold">Embedding Dimensions</label>
                                <Input
                                    value={effectiveDraft.embeddingDimensions}
                                    onChange={(e) =>
                                        patchDraft({
                                            embeddingDimensions: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-semibold">Embedding API Key（留空则保持不变）</label>
                                <Input
                                    type="password"
                                    value={effectiveDraft.embeddingApiKey}
                                    onChange={(e) =>
                                        patchDraft({
                                            embeddingApiKey: e.target.value,
                                        })
                                    }
                                    placeholder="sk-..."
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-1">
                            <Button
                                onClick={() => void onSaveConfig()}
                                disabled={savingRagConfig || testingConnection}
                            >
                                {savingRagConfig ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                保存配置
                            </Button>
                            
                            <Button
                                variant="outline"
                                onClick={() => void onTestConnection()}
                                disabled={savingRagConfig || testingConnection}
                            >
                                {testingConnection ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <Play className="h-4 w-4 mr-2" />
                                )}
                                测试连接
                            </Button>

                            {ragConfig?.embeddingApiKeySet ? (
                                <Badge variant="success">已配置 Embedding Key</Badge>
                            ) : (
                                <Badge variant="outline">未配置 Embedding Key</Badge>
                            )}

                            {testSuccessMessage ? (
                                <span className="text-sm text-emerald-600 ml-4 font-medium animate-in fade-in">
                                    {testSuccessMessage}
                                </span>
                            ) : null}
                        </div>
                    </section>

                    <section className="bg-card border border-border rounded-xl p-8 shadow-sm space-y-8 min-h-[500px]">
                        <div className="space-y-6 pb-6 border-b border-border">
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                <Upload className="h-5 w-5 text-primary" />
                                文档上传与切片
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-4">
                                    <label className="text-sm font-semibold">手动导入</label>
                                    <Input
                                        value={ragTitle}
                                        onChange={(e) => setRagTitle(e.target.value)}
                                        placeholder="文档标题（可选）"
                                    />
                                    <Textarea
                                        value={ragContent}
                                        onChange={(e) => setRagContent(e.target.value)}
                                        placeholder="输入或粘贴知识文档内容，点击上传后自动切片并进行 embedding..."
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
                                    <label className="text-sm font-semibold">文件上传</label>
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
                                                <p className="text-sm font-semibold">拖拽或点击上传</p>
                                                <p className="text-xs text-muted-foreground px-4">
                                                    支持文本类文件；上传后自动切片并触发 embedding
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {ragUploadMessage ? (
                            <div className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs text-emerald-700">
                                {ragUploadMessage}
                            </div>
                        ) : null}

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
                                                    variant={doc.embeddedChunkCount > 0 ? "success" : "secondary"}
                                                    className="px-2 font-mono text-[10px] tabular-nums shrink-0"
                                                >
                                                    {doc.embeddedChunkCount}/{doc.chunkCount} Embedded
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-4 text-[11px] text-muted-foreground pb-2 h-4 overflow-hidden">
                                                <span>Type: Text</span>
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
                    </section>
                </div>

                <div className="space-y-6 shrink-0">
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm overflow-hidden relative">
                        <h3 className="font-bold mb-4 flex items-center gap-2 underline decoration-primary decoration-4 underline-offset-4">
                            RAG 检索状态
                        </h3>
                        <div className="space-y-4 text-sm pt-2">
                            <div className="space-y-4">
                                <div className="flex items-center justify-between font-mono bg-muted/60 p-2 rounded-md border border-border/40 text-[13px] text-primary font-bold tracking-tight">
                                    <span>
                                        {ragStrategy?.mode?.toUpperCase() || "KEYWORD"} MODE
                                    </span>
                                    {ragStrategy?.shouldUseVectorDb ? (
                                        <Badge variant="destructive">Vector</Badge>
                                    ) : (
                                        <Badge variant="success">Keyword</Badge>
                                    )}
                                </div>
                                <p className="text-[13px] leading-relaxed text-muted-foreground border-l-2 border-primary/20 pl-4 py-1 italic">
                                    "{ragStrategy?.reason || "系统正在分析当前索引与检索策略..."}"
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 rounded-xl border border-blue-200 bg-blue-50 text-[13px] text-blue-800 space-y-3">
                        <div className="flex items-center gap-2 font-bold">
                            <AlertCircle className="h-4 w-4" />
                            <span>企业实践提示</span>
                        </div>
                        <p className="leading-relaxed opacity-90 leading-6">
                            建议在生产环境使用独立的 Embedding Key、开启配置审计，并定期重建索引。若数据规模较大，可优先选择
                            Hybrid 检索提升稳定性。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
