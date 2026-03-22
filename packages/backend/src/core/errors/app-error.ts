import { ApiErrorCode } from "share";

export type HttpStatus = 400 | 401 | 403 | 404 | 409 | 429 | 500;

export class AppError extends Error {
    status: HttpStatus;
    code: keyof typeof ApiErrorCode;
    details?: Record<string, unknown>;

    constructor(
        status: HttpStatus,
        code: keyof typeof ApiErrorCode,
        message: string,
        details?: Record<string, unknown>,
    ) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
