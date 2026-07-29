"use server";

import { signIn } from "@/lib/auth";

export async function signInWithGoogle(formData: FormData) {
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");
  await signIn("google", { redirectTo: callbackUrl });
}
