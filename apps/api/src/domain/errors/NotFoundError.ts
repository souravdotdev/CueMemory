import { AppError } from "./AppError";

/** The thing asked for doesn't exist (or isn't the caller's to see). */
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
  }
}
