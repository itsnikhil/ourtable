"use client";

import { useState, useTransition } from "react";
import { createHouseholdInvite } from "@/lib/actions/household-actions";
import { Button } from "@/components/ui/button";

export function InvitePartnerButton() {
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <Button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await createHouseholdInvite({});
            if (!result.success) {
              setError(result.error.message);
              return;
            }
            const url = `${window.location.origin}/join/${result.data.token}`;
            setInviteUrl(url);
          });
        }}
      >
        {pending ? "Creating…" : "Create invite link"}
      </Button>

      {inviteUrl ? (
        <div className="bg-muted space-y-2 rounded-md p-3 text-sm break-all">
          <p className="font-medium">Share this link with your partner:</p>
          <p>{inviteUrl}</p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => void navigator.clipboard.writeText(inviteUrl)}
          >
            Copy link
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
