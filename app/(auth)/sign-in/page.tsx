import { AuthSignInForm } from "@/components/auth/sign-in-form";
import { isAuthBypassEnabled } from "@/lib/auth-bypass-flag";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const bypass = isAuthBypassEnabled();

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Our Table</h1>
        <p className="text-muted-foreground text-sm">
          {bypass
            ? "Local auth bypass is enabled."
            : "Sign in with Google to track restaurants together."}
        </p>
      </div>
      <AuthSignInForm callbackUrl={params.callbackUrl ?? "/"} />
    </div>
  );
}
