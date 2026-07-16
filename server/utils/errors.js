export class AppError extends Error {
  constructor(code, message, { status = 400, retryable = false, details = undefined, cause } = {}) {
    super(message, { cause });
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.details = details;
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}
