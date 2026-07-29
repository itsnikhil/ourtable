import { InvitePartnerButton } from "@/components/household/invite-partner-button";
import { getHouseholdMembers } from "@/lib/queries/household";

export default async function HouseholdPage() {
  let members: Awaited<ReturnType<typeof getHouseholdMembers>> = [];
  let loadError: string | null = null;

  try {
    members = await getHouseholdMembers();
  } catch {
    loadError = "Could not load household members. Are you signed in?";
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Household</h1>
        <p className="text-muted-foreground text-sm">
          Invite your partner and manage members.
        </p>
      </div>

      {loadError ? (
        <p className="text-destructive text-sm">{loadError}</p>
      ) : (
        <ul className="space-y-2">
          {members.map((member) => (
            <li
              key={member.id}
              className="border-border flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
            >
              <span
                aria-hidden
                className="bg-muted inline-flex size-8 items-center justify-center rounded-full text-xs font-medium"
                style={
                  member.color
                    ? { backgroundColor: member.color, color: "#fff" }
                    : undefined
                }
              >
                {(member.displayName || "?").slice(0, 1).toUpperCase()}
              </span>
              <span>{member.displayName || "Unnamed"}</span>
            </li>
          ))}
        </ul>
      )}

      <InvitePartnerButton />
    </div>
  );
}
