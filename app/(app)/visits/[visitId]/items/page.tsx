import Link from "next/link";
import { notFound } from "next/navigation";
import { getVisitDetail } from "@/lib/queries/visit-queries";
import { requireAuthContext } from "@/lib/auth";
import { OrderedItemsPanel } from "@/components/visits/ordered-items-panel";

export default async function OrderedItemsPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const visit = await getVisitDetail(visitId);
  if (!visit) notFound();

  const { userId } = await requireAuthContext();

  return (
    <div className="space-y-4">
      <Link
        href={`/visits/${visit.id}`}
        className="text-muted-foreground text-sm hover:underline"
      >
        ← {visit.restaurantName}
      </Link>
      <OrderedItemsPanel
        visitId={visit.id}
        currentUserId={userId}
        items={visit.orderedItems}
      />
    </div>
  );
}
