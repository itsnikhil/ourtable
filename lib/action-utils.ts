import { z } from "zod";
import {
  AuthContextError,
  fail,
  ok,
  type ActionResult,
  type ErrorCode,
} from "@/lib/errors";

export function fieldErrorsFromZod(
  error: z.ZodError,
): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_root";
    fieldErrors[key] = fieldErrors[key] ?? [];
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}

/**
 * Shared Server Action boundary — maps expected failures to ActionResult,
 * logs unexpected errors as INTERNAL (LLD §1.3 / §11).
 */
export async function runAction<T>(
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AuthContextError) {
      return fail("UNAUTHORIZED", error.message);
    }
    if (error instanceof z.ZodError) {
      return fail(
        "VALIDATION_ERROR",
        "Invalid input.",
        fieldErrorsFromZod(error),
      );
    }
    console.error("[runAction]", error);
    return fail("INTERNAL", "Something went wrong.");
  }
}

export function actionFail<T = never>(
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<T> {
  return fail(code, message, fieldErrors);
}

export { ok, fail };
