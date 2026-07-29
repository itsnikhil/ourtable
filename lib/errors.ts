export type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL";

export type ActionError = {
  code: ErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: ActionError };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail<T = never>(
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> {
  return {
    success: false,
    error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) },
  };
}

export class AuthContextError extends Error {
  readonly code: ErrorCode = "UNAUTHORIZED";

  constructor(message = "You must be signed in.") {
    super(message);
    this.name = "AuthContextError";
  }
}
