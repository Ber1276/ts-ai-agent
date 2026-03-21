import axios from "axios";
import { type ApiResponse } from "share";

export const request = async <T>(
    url: string,
    options?: Omit<Parameters<typeof axios>[1], "url">,
): Promise<ApiResponse<T>> => {
    const response = await axios(url, options);
    const result = response.data as ApiResponse<T>;

    if (!result.success) {
        throw new Error(result.error?.message || "Request failed");
    }

    return result;
};
