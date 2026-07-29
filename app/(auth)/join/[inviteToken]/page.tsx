export default function JoinPage({
  params,
}: {
  params: Promise<{ inviteToken: string }>;
}) {
  return <JoinPageInner params={params} />;
}

async function JoinPageInner({
  params,
}: {
  params: Promise<{ inviteToken: string }>;
}) {
  const { inviteToken } = await params;
  const { AcceptInviteForm } = await import(
    "@/components/auth/accept-invite-form"
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Join household</h1>
        <p className="text-muted-foreground text-sm">
          Sign in to accept this invite and share one table.
        </p>
      </div>
      <AcceptInviteForm token={inviteToken} />
    </div>
  );
}
