import Link from "next/link";
import { signInWithGoogle } from "@/lib/actions/auth-actions";
import { isAuthBypassEnabled } from "@/lib/auth-bypass-flag";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AuthSignInForm({ callbackUrl }: { callbackUrl: string }) {
  const bypass = isAuthBypassEnabled();

  return (
    <div className="space-y-4">
      <form action={signInWithGoogle}>
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <Button type="submit" className="w-full">
          Continue with Google
        </Button>
      </form>

      {bypass ? (
        <div className="space-y-2">
          <p className="text-muted-foreground text-center text-xs">
            AUTH_BYPASS is on — skip Google for local testing.
          </p>
          <Link
            href={callbackUrl || "/"}
            className={cn(buttonVariants({ variant: "outline" }), "w-full")}
          >
            Continue as local test user
          </Link>
        </div>
      ) : null}
    </div>
  );
}
