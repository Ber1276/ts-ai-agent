import {
    Bot,
    Loader2,
    ShieldCheck,
    RefreshCw,
    AlertCircle,
    Settings,
    Plus,
    Pencil,
    Trash2,
    Database,
} from "lucide-react";
import { useChat } from "../hooks/useChat";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";

export function ModelsPage() {
    const {
        modelServices,
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
        deletingModelService,
        editingModelServiceId,
    } = useChat();

    const selectedPreset = modelServices.find(
        (item) => item.id === selectedServiceId,
    );

    const dbServices = modelServices.filter(
        (item) => item.source === "database",
    );
    const presetServices = modelServices.filter(
        (item) => item.source === "preset",
    );
    const isEditMode = Boolean(editingModelServiceId);

    return (
        <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            <header className="mb-8 flex items-end justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight mb-2 flex items-center gap-3">
                        <Bot className="h-8 w-8 text-primary" />
                        模型管理
                    </h1>
                    <p className="text-muted-foreground max-w-lg">
                        配置与管理您的 AI
                        模型服务。您可以切换不同厂商的预设模型，或者添加自定义的兼容
                        OpenAI 协议的接口服务。
                    </p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refreshModelServices()}
                    className="flex items-center gap-2"
                >
                    <RefreshCw className="h-4 w-4" />
                    更新列表
                </Button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <Database className="h-4 w-4 text-primary" />
                                已保存模型（数据库）
                            </h3>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={startCreatingModelService}
                                className="h-8"
                            >
                                <Plus className="h-3.5 w-3.5 mr-1" />
                                新建
                            </Button>
                        </div>

                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {dbServices.length === 0 ? (
                                <div className="rounded-md border border-dashed border-border p-4 text-xs text-muted-foreground italic">
                                    暂无自定义模型，请点击“新建”添加。
                                </div>
                            ) : (
                                dbServices.map((service) => {
                                    const rawId = service.id.replace(
                                        /^db:/,
                                        "",
                                    );
                                    const inEditing =
                                        editingModelServiceId === rawId;

                                    return (
                                        <div
                                            key={service.id}
                                            className="rounded-lg border border-border p-3 bg-background/70"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold truncate">
                                                        {service.label}
                                                    </p>
                                                    <p className="text-[11px] text-muted-foreground truncate font-mono">
                                                        {service.model}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    {service.isDefault && (
                                                        <Badge
                                                            variant="success"
                                                            className="h-5 text-[10px]"
                                                        >
                                                            默认
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
                                            <div className="mt-3 flex items-center gap-2">
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
                                                    disabled={
                                                        deletingModelService
                                                    }
                                                    onClick={() =>
                                                        void removeModelService(
                                                            service.id,
                                                        )
                                                    }
                                                >
                                                    {deletingModelService ? (
                                                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                                    ) : (
                                                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                                                    )}
                                                    删除
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div className="pt-2 border-t border-border space-y-2">
                            <h4 className="text-xs font-bold uppercase text-muted-foreground tracking-wider">
                                预设服务（只读）
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {presetServices.map((service) => (
                                    <Badge key={service.id} variant="secondary">
                                        {service.label}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                                服务提供商（用于测试与对话）
                            </label>
                            <select
                                value={selectedServiceId}
                                onChange={(e) =>
                                    setSelectedServiceId(e.target.value)
                                }
                                className="flex h-11 w-full rounded-md border border-input bg-background px-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                                {modelServices.map((service) => (
                                    <option key={service.id} value={service.id}>
                                        {service.label}
                                    </option>
                                ))}
                                <option value="custom">
                                    Custom Endpoint (OpenAI Compatible)
                                </option>
                            </select>
                        </div>

                        {selectedServiceId === "custom" ? (
                            <div className="space-y-4 animate-fade-up">
                                <div className="text-xs font-semibold px-3 py-2 rounded-md bg-primary/5 border border-primary/20 text-primary">
                                    {isEditMode
                                        ? "编辑已保存模型"
                                        : "创建新模型"}
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
                                        className="bg-muted/50"
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
                                        placeholder="gpt-4o / deepseek-chat"
                                        className="bg-muted/50"
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
                                        placeholder="sk-..."
                                        className="bg-muted/50"
                                    />
                                </div>
                                <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
                                    <input
                                        type="checkbox"
                                        checked={saveAsDefault}
                                        onChange={(e) =>
                                            setSaveAsDefault(e.target.checked)
                                        }
                                        className="h-3.5 w-3.5"
                                    />
                                    设为默认模型
                                </label>
                            </div>
                        ) : (
                            <div className="space-y-4 animate-fade-up">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold uppercase tracking-tighter text-muted-foreground opacity-60">
                                        预设路径
                                    </label>
                                    <div className="px-4 py-3 rounded-md bg-muted/80 border border-border text-sm text-muted-foreground font-mono truncate">
                                        {selectedPreset?.endpoint}
                                    </div>
                                </div>
                                {selectedPreset?.needsClientApiKey && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold">
                                            自定义 API Key
                                        </label>
                                        <Input
                                            type="password"
                                            value={presetApiKeyOverride}
                                            onChange={(e) =>
                                                setPresetApiKeyOverride(
                                                    e.target.value,
                                                )
                                            }
                                            placeholder="输入私有 Key 覆盖服务器默认值"
                                            className="bg-muted/50"
                                        />
                                    </div>
                                )}
                                <div className="p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20 text-emerald-600 text-[13px] flex items-start gap-3">
                                    <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0" />
                                    <p>
                                        当前使用系统预置服务，模型能力已调至最优（Top-P=0.9,
                                        Temp=0.7）。
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="pt-4 flex gap-3">
                            <Button
                                variant="outline"
                                onClick={() => void runModelServiceTest()}
                                disabled={testingModelService}
                                className="flex-1"
                            >
                                {testingModelService ? (
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                ) : (
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                )}
                                测试连通性
                            </Button>
                            {selectedServiceId === "custom" ? (
                                <>
                                    {isEditMode && (
                                        <Button
                                            variant="outline"
                                            onClick={cancelEditingModelService}
                                            className="flex-1"
                                        >
                                            取消编辑
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() =>
                                            void persistModelService()
                                        }
                                        disabled={savingModelService}
                                        className="flex-1"
                                    >
                                        {savingModelService ? (
                                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        ) : isEditMode ? (
                                            "更新模型"
                                        ) : (
                                            "创建模型"
                                        )}
                                    </Button>
                                </>
                            ) : null}
                        </div>

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
                                {!modelTestResult.ok &&
                                modelTestResult.error ? (
                                    <div className="mt-1">
                                        错误: {modelTestResult.error}
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-card border border-border rounded-xl p-6 shadow-sm overflow-hidden relative">
                        <h3 className="font-bold mb-4 flex items-center gap-2">
                            系统详情
                        </h3>
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-y-4 border-b border-border pb-4">
                                <span className="text-muted-foreground">
                                    模型 ID:
                                </span>
                                <span className="font-medium font-mono">
                                    {selectedPreset?.model || customModel}
                                </span>
                                <span className="text-muted-foreground">
                                    上下文限制:
                                </span>
                                <span className="font-medium uppercase">
                                    128K Tokens
                                </span>
                            </div>
                            <div className="space-y-2">
                                <span className="text-xs font-bold uppercase text-muted-foreground tracking-widest">
                                    支持功能
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
                        <div className="absolute -bottom-6 -right-6 opacity-5 rotate-12">
                            <Settings className="h-32 w-32" />
                        </div>
                    </div>

                    <div className="p-6 rounded-xl border border-amber-200 bg-amber-50 text-[13px] text-amber-800 space-y-3">
                        <div className="flex items-center gap-2 font-bold">
                            <AlertCircle className="h-4 w-4" />
                            <span>调试建议</span>
                        </div>
                        <p className="leading-relaxed opacity-90">
                            如果遇到 404 错误，请检查 API Endpoint 是否包含了
                            `/v1` 路径。DeepSeek 用户推荐直接使用官方路径
                            `https://api.deepseek.com`。
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
