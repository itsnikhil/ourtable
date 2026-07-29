"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acceptHouseholdInvite } from "@/lib/actions/household-actions";
import { Button } from "@/components/ui/button";

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-4">
      <Button
        className="w-full"
        disabled={pending}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            const result = await acceptHouseholdInvite({ token });
            if (!result.success) {
              if (result.error.code === "UNAUTHORIZED") {
                router.push(
                  `/sign-in?callbackUrl=${encodeURIComponent(`/join/${token}`)}`,
                );
                return;
              }
              setMessage(result.error.message);
              return;
            }
            router.push("/");
            router.refresh();
          });
        }}
      >
        {pending ? "Joining…" : "Accept invite"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Need an account first?{" "}
        <Link
          className="text-foreground underline"
          href={`/sign-in?callbackUrl=${encodeURIComponent(`/join/${token}`)}`}
        >
          Sign in
        </Link>
      </p>
      {message ? <p className="text-destructive text-sm">{message}</p> : null}
    </div>
  );
}
