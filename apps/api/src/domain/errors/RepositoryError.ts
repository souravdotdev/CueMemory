import { AppError } from "./AppError";

/** Storage failed underneath a repository; the cause stays in logs, never in a response. */
export class RepositoryError extends AppError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, "REPOSITORY_ERROR");
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}
