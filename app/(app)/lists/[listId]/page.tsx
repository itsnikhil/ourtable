import Link from "next/link";
import { Card } from "@/components/design/card";
import { DEFAULT_SMART_LISTS } from "@/lib/smart-lists";

export default async function Page({
  params,
}: {
  params: Promise<{ listId: string }>;
}) {
  const { listId } = await params;
  const list = DEFAULT_SMART_LISTS.find((item) => item.smartRule.key === listId);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link
          href="/lists"
          className="text-muted-foreground text-sm font-medium"
        >
          ← Lists
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">
          {list?.name ?? "List"}
        </h1>
      </div>
      <Card>
        <p className="text-muted-foreground text-sm">
          Coming soon. Place queries for this list are not wired yet.
        </p>
      </Card>
    </div>
  );
}
