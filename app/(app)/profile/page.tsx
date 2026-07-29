import Link from "next/link";
import { auth, signOut } from "@/lib/auth";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function ProfilePage() {
  const session = await auth();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm">
          {session?.user?.email ?? "Signed in"}
        </p>
      </div>

      <div className="space-y-3">
        <Link
          href="/profile/household"
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          Household & invites
        </Link>

        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/sign-in" });
          }}
        >
          <Button type="submit" variant="ghost" className="w-full">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
