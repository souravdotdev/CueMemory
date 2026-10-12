import type { User } from "../user";

/** Finds the User whose Session a request carries. The auth library implements it. */
export interface SessionResolver {
  /** The User of the request's valid Session, or null when it carries none. */
  resolve(headers: Headers): Promise<User | null>;
}
