import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    cancelChatStream,
    deleteModelService,
    fetchRagStrategy,
    fetchModelServices,
    fetchChatResponse,
    type IndexedDocumentInfo,
    type RagStrategyInfo,
    saveModelService,
    startChatStream,
    testModelService,
    updateModelService,
    uploadRagDocument,
} from "../api/chatApi";
import type { UIMessage } from "../types/chat";
import type {
    ModelSelectionInput,
    ModelServiceItem,
    ModelServiceTestResult,
} from "share";

function createMessage(
    role: UIMessage["role"],
    content: string,
    prefix: string,
): UIMessage {
    return {
        id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role,
        content,
    };
}

export function useChat() {
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<UIMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastHeartbeatAt, setLastHeartbeatAt] = useState<number | null>(null);
    const [activeRunId, setActiveRunId] = useState<string | null>(null);
    const [modelServices, setModelServices] = useState<ModelServiceItem[]>([]);
    const [loadingModelServices, setLoadingModelServices] = useState(false);
    const [selectedServiceId, setSelectedServiceId] = useState("custom");
    const [customEndpoint, setCustomEndpoint] = useState("");
    const [customModel, setCustomModel] = useState("");
    const [customApiKey, setCustomApiKey] = useState("");
    const [presetApiKeyOverride, setPresetApiKeyOverride] = useState("");
    const [saveAsDefault, setSaveAsDefault] = useState(true);
    const [modelTestResult, setModelTestResult] =
        useState<ModelServiceTestResult | null>(null);
    const [testingModelService, setTestingModelService] = useState(false);
    const [savingModelService, setSavingModelService] = useState(false);
    const [deletingModelService, setDeletingModelService] = useState(false);
    const [editingModelServiceId, setEditingModelServiceId] = useState<
        string | null
    >(null);
    const [ragStrategy, setRagStrategy] = useState<RagStrategyInfo | null>(
        null,
    );
    const [indexedDocuments, setIndexedDocuments] = useState<
        IndexedDocumentInfo[]
    >([]);
    const [loadingRag, setLoadingRag] = useState(false);
    const [uploadingRag, setUploadingRag] = useState(false);
    const [ragUploadMessage, setRagUploadMessage] = useState<string | null>(
        null,
    );
    const [ragTitle, setRagTitle] = useState("");
    const [ragContent, setRagContent] = useState("");
    const stopStreamRef = useRef<(() => void) | null>(null);

    const buildModelSelection = useCallback(():
        | ModelSelectionInput
        | undefined => {
        if (selectedServiceId === "custom") {
            const hasCompleteCustomConfig =
                !!customEndpoint.trim() &&
                !!customModel.trim() &&
                !!customApiKey.trim();

            if (hasCompleteCustomConfig) {
                return {
                    endpoint: customEndpoint.trim(),
                    model: customModel.trim(),
                    apiKey: customApiKey.trim(),
                };
            }

            const fallbackService =
                modelServices.find((item) => item.isDefault) ??
                modelServices[0];

            if (fallbackService) {
                return {
                    serviceId: fallbackService.id,
                    apiKey: presetApiKeyOverride.trim() || undefined,
                };
            }

            if (
                !customEndpoint.trim() ||
                !customModel.trim() ||
                !customApiKey.trim()
            ) {
                return undefined;
            }
        }

        return {
            serviceId: selectedServiceId,
            apiKey: presetApiKeyOverride.trim() || undefined,
        };
    }, [
        customApiKey,
        customEndpoint,
        customModel,
        modelServices,
        presetApiKeyOverride,
        selectedServiceId,
    ]);

    const refreshModelServices = useCallback(async () => {
        setLoadingModelServices(true);
        try {
            const services = await fetchModelServices();
            setModelServices(services);

            setSelectedServiceId((prev) => {
                if (prev === "custom") {
                    const hasCompleteCustomConfig =
                        !!customEndpoint.trim() &&
                        !!customModel.trim() &&
                        !!customApiKey.trim();

                    if (hasCompleteCustomConfig) {
                        return prev;
                    }
                }

                if (services.some((item) => item.id === prev)) {
                    return prev;
                }

                const defaultService = services.find((item) => item.isDefault);
                return defaultService?.id ?? services[0]?.id ?? "custom";
            });
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to load model services";
            setError(message);
        } finally {
            setLoadingModelServices(false);
        }
    }, [customApiKey, customEndpoint, customModel]);

    useEffect(() => {
        void refreshModelServices();
    }, [refreshModelServices]);

    const refreshRagOverview = useCallback(async () => {
        setLoadingRag(true);
        try {
            const data = await fetchRagStrategy();
            setRagStrategy(data.strategy);
            setIndexedDocuments(data.indexedDocuments);
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Failed to load RAG overview";
            setError(message);
        } finally {
            setLoadingRag(false);
        }
    }, []);

    useEffect(() => {
        void refreshRagOverview();
    }, [refreshRagOverview]);

    useEffect(() => {
        setModelTestResult(null);
    }, [
        selectedServiceId,
        customEndpoint,
        customModel,
        customApiKey,
        presetApiKeyOverride,
    ]);

    const runModelServiceTest = useCallback(async () => {
        const modelSelection = buildModelSelection();
        if (!modelSelection) {
            setError(
                "Model config is incomplete. Fill endpoint/model/apiKey or choose a preset.",
            );
            return;
        }

        setTestingModelService(true);
        setModelTestResult(null);
        setError(null);

        try {
            const result = await testModelService(modelSelection);
            setModelTestResult(result);
            if (!result.ok) {
                setError(result.error || "Model service test failed");
            }
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Model service test failed";
            setError(message);
        } finally {
            setTestingModelService(false);
        }
    }, [buildModelSelection]);

    const persistModelService = useCallback(async () => {
        if (selectedServiceId !== "custom") {
            setError("Only custom service can be saved to database.");
            return;
        }

        const endpoint = customEndpoint.trim();
        const model = customModel.trim();
        const apiKey = customApiKey.trim();

        if (!endpoint || !model || !apiKey) {
            setError("endpoint/model/apiKey are required for saving model.");
            return;
        }

        setSavingModelService(true);
        setError(null);

        try {
            const label = `${model} @ ${new URL(endpoint).host}`;
            const data = editingModelServiceId
                ? await updateModelService(editingModelServiceId, {
                      label,
                      endpoint,
                      model,
                      apiKey,
                      isDefault: saveAsDefault,
                  })
                : await saveModelService({
                      label,
                      endpoint,
                      model,
                      apiKey,
                      isDefault: saveAsDefault,
                  });

            setModelServices(data.services);
            setSelectedServiceId(data.saved.id);
            setPresetApiKeyOverride("");
            setEditingModelServiceId(null);
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Save model service failed";
            setError(message);
        } finally {
            setSavingModelService(false);
        }
    }, [
        customApiKey,
        customEndpoint,
        customModel,
        saveAsDefault,
        selectedServiceId,
        editingModelServiceId,
    ]);

    const startCreatingModelService = useCallback(() => {
        setSelectedServiceId("custom");
        setCustomEndpoint("");
        setCustomModel("");
        setCustomApiKey("");
        setSaveAsDefault(true);
        setEditingModelServiceId(null);
        setError(null);
    }, []);

    const startEditingModelService = useCallback(
        (serviceId: string) => {
            const service = modelServices.find((item) => item.id === serviceId);
            if (!service || service.source !== "database") {
                setError("Only database model service can be edited.");
                return;
            }

            setSelectedServiceId("custom");
            setCustomEndpoint(service.endpoint);
            setCustomModel(service.model);
            setCustomApiKey("");
            setSaveAsDefault(service.isDefault);
            setEditingModelServiceId(service.id.replace(/^db:/, ""));
            setError(null);
        },
        [modelServices],
    );

    const cancelEditingModelService = useCallback(() => {
        setEditingModelServiceId(null);
        setCustomEndpoint("");
        setCustomModel("");
        setCustomApiKey("");
        setSaveAsDefault(true);
        setSelectedServiceId("custom");
    }, []);

    const removeModelService = useCallback(async (serviceId: string) => {
        const id = serviceId.replace(/^db:/, "").trim();
        if (!id) {
            setError("Invalid service id");
            return;
        }

        setDeletingModelService(true);
        setError(null);
        try {
            const data = await deleteModelService(id);
            setModelServices(data.services);
            setSelectedServiceId((prev) => {
                if (prev !== serviceId) {
                    return prev;
                }
                const nextDefault = data.services.find(
                    (item) => item.isDefault,
                );
                return nextDefault?.id ?? data.services[0]?.id ?? "custom";
            });

            setEditingModelServiceId((prev) => {
                if (!prev) {
                    return null;
                }
                return prev === id ? null : prev;
            });
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Delete model service failed";
            setError(message);
        } finally {
            setDeletingModelService(false);
        }
    }, []);

    const uploadRagFromText = useCallback(async () => {
        const title = ragTitle.trim();
        const content = ragContent.trim();
        if (!content) {
            setError("RAG text content cannot be empty.");
            return;
        }

        setUploadingRag(true);
        setRagUploadMessage(null);
        setError(null);
        try {
            const result = await uploadRagDocument({
                title: title || undefined,
                content,
            });
            setRagUploadMessage(
                `Indexed ${result.ingested.title} with ${result.ingested.chunkCount} chunks.`,
            );
            setRagContent("");
            setRagTitle("");
            await refreshRagOverview();
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Upload document failed";
            setError(message);
        } finally {
            setUploadingRag(false);
        }
    }, [ragContent, ragTitle, refreshRagOverview]);

    const uploadRagFromFile = useCallback(
        async (file: File) => {
            setUploadingRag(true);
            setRagUploadMessage(null);
            setError(null);
            try {
                const result = await uploadRagDocument({ file });
                setRagUploadMessage(
                    `Indexed ${result.ingested.title} with ${result.ingested.chunkCount} chunks.`,
                );
                await refreshRagOverview();
            } catch (err) {
                const message =
                    err instanceof Error
                        ? err.message
                        : "Upload document failed";
                setError(message);
            } finally {
                setUploadingRag(false);
            }
        },
        [refreshRagOverview],
    );

    const appendMessage = useCallback((message: UIMessage) => {
        setMessages((prev) => [...prev, message]);
    }, []);

    const sendOnce = useCallback(async () => {
        if (!input.trim()) {
            return;
        }

        const currentInput = input.trim();
        appendMessage(createMessage("user", currentInput, "u"));
        setInput("");
        setLoading(true);
        setError(null);

        try {
            const response = await fetchChatResponse(currentInput);
            appendMessage(createMessage("assistant", response, "a"));
        } catch (err) {
            const errorMsg =
                err instanceof Error ? err.message : "Failed to fetch response";
            setError(errorMsg);
            appendMessage(
                createMessage("assistant", `Error: ${errorMsg}`, "a-err"),
            );
        } finally {
            setLoading(false);
        }
    }, [appendMessage, input]);

    const sendStream = useCallback(() => {
        if (!input.trim() || streaming) {
            return;
        }

        const modelSelection = buildModelSelection();
        if (!modelSelection) {
            setError(
                "Model config is incomplete. Fill endpoint/model/apiKey or choose a preset.",
            );
            return;
        }

        const currentInput = input.trim();
        appendMessage(createMessage("user", currentInput, "u"));
        setInput("");
        setStreaming(true);
        setError(null);
        setLastHeartbeatAt(null);

        const assistantMessageId = `a-stream-${Date.now()}`;
        appendMessage({
            id: assistantMessageId,
            role: "assistant",
            content: "",
        });

        stopStreamRef.current = startChatStream(currentInput, modelSelection, {
            onRunStart: (event) => {
                setActiveRunId(event.runId);
            },
            onChunk: (event) => {
                setActiveRunId((prev) => prev ?? event.runId);
                setMessages((prev) =>
                    prev.map((item) =>
                        item.id === assistantMessageId
                            ? {
                                  ...item,
                                  content:
                                      event.chunkType === "reasoning"
                                          ? item.content
                                          : `${item.content}${event.content}`,
                                  metadata:
                                      event.chunkType === "reasoning"
                                          ? {
                                                ...item.metadata,
                                                thinking: `${item.metadata?.thinking ?? ""}${event.content}`,
                                            }
                                          : item.metadata,
                              }
                            : item,
                    ),
                );
            },
            onDone: () => {
                setStreaming(false);
                setActiveRunId(null);
            },
            onError: (message) => {
                setError(message);
                setStreaming(false);
                setActiveRunId(null);
            },
            onHeartbeat: (event) => {
                setLastHeartbeatAt(event.ts);
            },
        });

        // TODO(handwrite): add reconnect strategy with exponential backoff.
        // Required: persist last received chunk index and support resume after reconnect.
    }, [appendMessage, buildModelSelection, input, streaming]);

    const stopStream = useCallback(async () => {
        if (stopStreamRef.current) {
            stopStreamRef.current();
            stopStreamRef.current = null;
        }

        if (activeRunId) {
            try {
                await cancelChatStream(activeRunId);
            } catch (err) {
                const errorMsg =
                    err instanceof Error
                        ? err.message
                        : "Failed to cancel stream";
                setError(errorMsg);
            }
        }

        setStreaming(false);
        setActiveRunId(null);
    }, [activeRunId]);

    const canSend = useMemo(
        () => !loading && !streaming && input.trim().length > 0,
        [input, loading, streaming],
    );

    const clearChat = useCallback(() => {
        setMessages([]);
        setInput("");
        setError(null);
    }, []);

    const sendMessage = useCallback(async () => {
        if (!canSend) return;
        return sendStream();
    }, [canSend, sendStream]);

    const clearError = useCallback(() => {
        setError(null);
    }, []);

    const isThinking = useMemo(
        () => loading || streaming,
        [loading, streaming],
    );

    const activeModel = useMemo(() => {
        if (selectedServiceId === "custom") {
            return {
                id: customModel || "custom-endpoint",
                name: customModel || "Custom AI",
                provider: "OpenAI (Custom)",
            };
        }
        const service = modelServices.find((s) => s.id === selectedServiceId);
        return service
            ? {
                  id: service.id,
                  name: service.label,
                  provider: service.endpoint,
              }
            : null;
    }, [selectedServiceId, customModel, modelServices]);

    return {
        input,
        setInput,
        messages,
        loading,
        streaming,
        error,
        lastHeartbeatAt,
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
        testingModelService,
        savingModelService,
        deletingModelService,
        editingModelServiceId,
        ragStrategy,
        indexedDocuments,
        loadingRag,
        uploadingRag,
        ragUploadMessage,
        ragTitle,
        setRagTitle,
        ragContent,
        setRagContent,
        runModelServiceTest,
        persistModelService,
        startCreatingModelService,
        startEditingModelService,
        cancelEditingModelService,
        removeModelService,
        refreshModelServices,
        refreshRagOverview,
        uploadRagFromText,
        uploadRagFromFile,
        canSend,
        sendOnce,
        sendStream,
        stopStream,
        clearChat,
        sendMessage,
        clearError,
        isThinking,
        activeModel,
    };
}
