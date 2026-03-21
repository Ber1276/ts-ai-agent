import { useState, useCallback } from "react";
import { type ApiResponse } from "share";

interface UseApiState<T> {
    data: T | null;
    loading: boolean;
    error: string | null;
}

/**
 * 通用 API 调用 Hook
 * 自动处理泛型 ApiResponse 的成功/失败逻辑
 * @template T - 响应数据类型
 */
export function useApi<T>() {
    const [state, setState] = useState<UseApiState<T>>({
        data: null,
        loading: false,
        error: null,
    });

    const execute = useCallback(async (promise: Promise<ApiResponse<T>>) => {
        setState({ data: null, loading: true, error: null });
        try {
            const response = await promise;
            if (!response.success) {
                throw new Error(response.error?.message || "Request failed");
            }
            setState({
                data: response.data ?? null,
                loading: false,
                error: null,
            });
            return response.data;
        } catch (err) {
            const errorMessage =
                err instanceof Error ? err.message : "Unknown error";
            setState({ data: null, loading: false, error: errorMessage });
            throw err;
        }
    }, []);

    return { ...state, execute };
}
