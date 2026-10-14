import { AppError } from "./AppError";

/** The request has no valid Session, or its Session belongs to a deleted User. */
export class UnauthorizedError extends AppError {
  constructor(message = "No valid Session") {
    super(message, "UNAUTHORIZED");
  }
}
