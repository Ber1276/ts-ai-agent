import {
    AlertCircle,
    Bot,
    ChevronDown,
    Database,
    Loader2,
    Pencil,
    Plus,
    RefreshCw,
    Settings,
    ShieldCheck,
    Trash2,
} from "lucide-react";
import { useMemo } from "react";
import { useChat } from "../hooks/useChat";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";

export function ModelsPage() {
    const {
        modelServices,
        loadingModelServices,
        selectedServiceId,
        setSelectedServiceId,
        customEndpoint,
        setCustomEndpoint,
        customModel,
        setCustomModel,
        customApiKey,
        setCustomApiKey,
        presetApiKeyOverride,
        setPresetApiKeyOverride,
        saveAsDefault,
        setSaveAsDefault,
        modelTestResult,
        runModelServiceTest,
        persistModelService,
        startCreatingModelService,
        startEditingModelService,
        cancelEditingModelService,
        removeModelService,
        refreshModelServices,
        testingModelService,
        savingModelService,
        deletingModelServiceId,
        editingModelServiceId,
    } = useChat({ loadRagOverview: false });

    const dbServices = useMemo(
        () => modelServices.filter((item) => item.source === "database"),
        [modelServices],
    );
    const presetServices = useMemo(
        () => modelServices.filter((item) => item.source === "preset"),
        [modelServices],
    );

    const isEditMode = Boolean(editingModelServiceId);
    const isCustom = selectedServiceId === "custom";
    const selectedPreset = modelServices.find(
        (item) => item.id === selectedServiceId,
    );

    const canSaveCustom =
        customEndpoint.trim().length > 0 &&
        customModel.trim().length > 0 &&
        (isEditMode || customApiKey.trim().length > 0);

    return (
        <div className="flex-1 min-h-0 overflow-y-auto p-8 bg-gradient-to-b from-background to-muted/20">
            <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                        <Bot className="h-8 w-8 text-primary" />
                        模型管理
                    </h1>
                    <p className="text-muted-foreground max-w-2xl leading-relaxed">
                        配置与管理 AI 模型服务。支持切换系统预设，也支持新增/编辑 OpenAI 兼容端点。
                    </p>
                </div>

                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refreshModelServices()}
                    disabled={loadingModelServices}
                    className="min-w-[116px]"
                >
                    {loadingModelServices ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    刷新列表
                </Button>
            </header>

            <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
                <section className="space-y-6">
                    <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-sm font-bold flex items-center gap-2">
                                <Database className="h-4 w-4 text-primary" />
                                已保存模型（数据库）
                            </h2>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={startCreatingModelService}
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                新建
                            </Button>
                        </div>

                        {loadingModelServices ? (
                            <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
                                正在加载模型服务...
                            </div>
                        ) : dbServices.length === 0 ? (
                            <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground italic">
                                暂无自定义模型，点击“新建”开始配置。
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                                {dbServices.map((service) => {
                                    const rawId = service.id.replace(/^db:/, "");
                                    const inEditing =
                                        editingModelServiceId === rawId;
                                    const inDeleting =
                                        deletingModelServiceId === service.id;
                                    const inUse = selectedServiceId === service.id;

                                    return (
                                        <div
                                            key={service.id}
                                            className="rounded-lg border border-border bg-background/70 p-3 space-y-3"
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate">
                                                        {service.label}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground truncate font-mono">
                                                        {service.model}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    {service.isDefault && (
                                                        <Badge
                                                            variant="success"
                                                            className="h-5 text-[10px]"
                                                        >
                                                            默认
                                                        </Badge>
                                                    )}
                                                    {inUse && (
                                                        <Badge
                                                            variant="secondary"
                                                            className="h-5 text-[10px]"
                                                        >
                                                            当前使用
                                                        </Badge>
                                                    )}
                                                    {inEditing && (
                                                        <Badge
                                                            variant="outline"
                                                            className="h-5 text-[10px]"
                                                        >
                                                            编辑中
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs"
                                                    onClick={() =>
                                                        setSelectedServiceId(
                                                            service.id,
                                                        )
                                                    }
                                                >
                                                    使用
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 text-xs"
                                                    onClick={() =>
                                                        startEditingModelService(
                                                            service.id,
                                                        )
                                                    }
                                                >
                                                    <Pencil className="h-3.5 w-3.5 mr-1" />
                                                    编辑
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    className="h-7 text-xs"
                                                    disabled={inDeleting}
                                                    onClick={() =>
                                                        void removeModelService(
                                                            service.id,
                                                        )
                                                    }
                                                >
                                                    {inDeleting ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                                    ) : (
                                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                                    )}
                                                    删除
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        <div className="pt-3 border-t border-border space-y-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                系统预设（只读）
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {presetServices.length === 0 ? (
                                    <Badge variant="outline">暂无预设</Badge>
                                ) : (
                                    presetServices.map((service) => (
                                        <Badge
                                            key={service.id}
                                            variant="secondary"
                                        >
                                            {service.label}
                                        </Badge>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-5">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                服务提供商（用于测试与对话）
                            </label>
                            <div className="relative">
                                <select
                                    value={selectedServiceId}
                                    onChange={(e) =>
                                        setSelectedServiceId(e.target.value)
                                    }
                                    className="h-11 w-full appearance-none rounded-md border border-input bg-background px-4 pr-10 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {modelServices.map((service) => (
                                        <option key={service.id} value={service.id}>
                                            {service.label}
                                        </option>
                                    ))}
                                    <option value="custom">
                                        自定义 Endpoint（OpenAI Compatible）
                                    </option>
                                </select>
                                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            </div>
                        </div>

                        {isCustom ? (
                            <div className="space-y-4 animate-fade-up">
                                <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary">
                                    {isEditMode ? "编辑已保存模型" : "创建新模型"}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold">
                                        API Endpoint
                                    </label>
                                    <Input
                                        value={customEndpoint}
                                        onChange={(e) =>
                                            setCustomEndpoint(e.target.value)
                                        }
                                        placeholder="https://api.openai.com/v1"
                                        className="bg-muted/40"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold">
                                        模型代号
                                    </label>
                                    <Input
                                        value={customModel}
                                        onChange={(e) =>
                                            setCustomModel(e.target.value)
                                        }
                                        placeholder="gpt-4.1 / deepseek-chat"
                                        className="bg-muted/40"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-semibold">
                                        API Key
                                    </label>
                                    <Input
                                        type="password"
                                        value={customApiKey}
                                        onChange={(e) =>
                                            setCustomApiKey(e.target.value)
                                        }
                                        placeholder={
                                            isEditMode
                                                ? "留空表示保持原 Key"
                                                : "sk-..."
                                        }
                                        className="bg-muted/40"
                                    />
                                </div>

                                <label className="inline-flex items-center gap-2 text-xs text-muted-foreground select-none">
                                    <input
                                        type="checkbox"
                                        checked={saveAsDefault}
                                        onChange={(e) =>
                                            setSaveAsDefault(e.target.checked)
                                        }
                                        className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                                    />
                                    设为默认模型
                                </label>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-up">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        预设路径
                                    </label>
                                    <div className="rounded-md border border-border bg-muted/70 px-4 py-3 text-sm font-mono text-muted-foreground break-all">
                                        {selectedPreset?.endpoint || "-"}
                                    </div>
                                </div>

                                {selectedPreset?.needsClientApiKey && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold">
                                            覆盖 API Key（可选）
                                        </label>
                                        <Input
                                            type="password"
                                            value={presetApiKeyOverride}
                                            onChange={(e) =>
                                                setPresetApiKeyOverride(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="输入私有 Key 覆盖服务端默认配置"
                                            className="bg-muted/40"
                                        />
                                    </div>
                                )}

                                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-[13px] text-emerald-700">
                                    当前使用系统预置服务，推荐先做连通性测试后再进入对话页面。
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => void runModelServiceTest()}
                                disabled={testingModelService}
                                className="min-w-[124px]"
                            >
                                {testingModelService ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                )}
                                测试连通性
                            </Button>

                            {isCustom && (
                                <>
                                    {isEditMode && (
                                        <Button
                                            variant="outline"
                                            onClick={cancelEditingModelService}
                                            disabled={savingModelService}
                                        >
                                            取消编辑
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() =>
                                            void persistModelService()
                                        }
                                        disabled={
                                            savingModelService || !canSaveCustom
                                        }
                                    >
                                        {savingModelService ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : null}
                                        {isEditMode
                                            ? "更新模型"
                                            : "创建模型"}
                                    </Button>
                                </>
                            )}
                        </div>

                        {isCustom && !canSaveCustom && (
                            <p className="text-xs text-muted-foreground">
                                保存前请填写 Endpoint、模型名，新增模型还需要 API Key。
                            </p>
                        )}

                        {modelTestResult && (
                            <div
                                className={`rounded-md border p-3 text-xs ${
                                    modelTestResult.ok
                                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                        : "border-red-300 bg-red-50 text-red-700"
                                }`}
                            >
                                <div className="font-semibold mb-1">
                                    {modelTestResult.ok
                                        ? "连通性测试成功"
                                        : "连通性测试失败"}
                                </div>
                                <div className="font-mono opacity-90 break-all">
                                    {modelTestResult.resolvedEndpoint} /{" "}
                                    {modelTestResult.resolvedModel}
                                </div>
                                <div className="mt-1">
                                    延迟: {modelTestResult.latencyMs} ms
                                </div>
                                {modelTestResult.preview ? (
                                    <div className="mt-1 line-clamp-2">
                                        预览: {modelTestResult.preview}
                                    </div>
                                ) : null}
                                {!modelTestResult.ok &&
                                modelTestResult.error ? (
                                    <div className="mt-1 break-all">
                                        错误: {modelTestResult.error}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </section>

                <section className="space-y-6">
                    <div className="rounded-xl border border-border bg-card p-6 shadow-sm overflow-hidden relative">
                        <h2 className="font-bold mb-4 flex items-center gap-2">
                            系统详情
                        </h2>

                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-y-4 border-b border-border pb-4">
                                <span className="text-muted-foreground">
                                    当前模型:
                                </span>
                                <span className="font-medium break-all">
                                    {isCustom
                                        ? customModel || "未填写"
                                        : selectedPreset?.model || "-"}
                                </span>

                                <span className="text-muted-foreground">
                                    服务类型:
                                </span>
                                <span className="font-medium">
                                    {isCustom ? "Custom" : "Preset / DB"}
                                </span>

                                <span className="text-muted-foreground">
                                    上下文窗口:
                                </span>
                                <span className="font-medium">128K Tokens</span>
                            </div>

                            <div className="space-y-2">
                                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    支持能力
                                </span>
                                <div className="flex flex-wrap gap-2 pt-1">
                                    <Badge variant="secondary">
                                        SSE Streaming
                                    </Badge>
                                    <Badge variant="secondary">JSON Mode</Badge>
                                    <Badge variant="secondary">Tool Use</Badge>
                                    <Badge variant="outline">Multimodal</Badge>
                                </div>
                            </div>
                        </div>

                        <div className="absolute -bottom-5 -right-5 rotate-12 opacity-5">
                            <Settings className="h-28 w-28" />
                        </div>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-[13px] text-amber-800 space-y-3">
                        <div className="flex items-center gap-2 font-bold">
                            <AlertCircle className="h-4 w-4" />
                            调试建议
                        </div>
                        <p className="leading-relaxed opacity-90">
                            如果遇到 404，请确认 Endpoint 是否包含正确的 API 路径（常见是 `/v1`）。
                            如使用 DeepSeek，推荐使用官方地址 `https://api.deepseek.com`。
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}
