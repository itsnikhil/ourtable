import { InvitePartnerButton } from "@/components/household/invite-partner-button";
import { Card } from "@/components/design/card";
import { PersonBadge } from "@/components/design/person-avatar";
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
        <h1 className="font-heading text-3xl">Household</h1>
        <p className="text-muted-foreground text-sm">
          Invite your partner and manage members.
        </p>
      </div>

      {loadError ? (
        <p className="text-destructive text-sm">{loadError}</p>
      ) : (
        <ul className="space-y-3">
          {members.map((member, index) => (
            <li key={member.id}>
              <Card className="py-3">
                <PersonBadge
                  name={member.displayName || "Unnamed"}
                  imageUrl={member.avatarUrl}
                  index={index}
                  id={member.id}
                />
              </Card>
            </li>
          ))}
        </ul>
      )}

      <InvitePartnerButton />
    </div>
  );
}
