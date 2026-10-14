/** Every code a domain error can carry. The interface layer decides what each means over HTTP. */
export type AppErrorCode =
  "NOT_FOUND" | "REPOSITORY_ERROR" | "UNAUTHORIZED" | "USER_PERMANENTLY_DELETED";

/**
 * The base of every domain error: a message for logs and a code for callers.
 * It carries no HTTP status; `interface/middleware/error.middleware.ts` maps codes to responses.
 */
export class AppError extends Error {
  constructor(
    message: string,
    readonly code: AppErrorCode,
  ) {
    super(message);
    this.name = new.target.name;
  }
}
