import Link from "next/link";
import { notFound } from "next/navigation";
import { getVisitDetail } from "@/lib/queries/visit-queries";
import { RateVisitForm } from "@/components/visits/rate-visit-form";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function RateVisitPage({
  params,
}: {
  params: Promise<{ visitId: string }>;
}) {
  const { visitId } = await params;
  const visit = await getVisitDetail(visitId);
  if (!visit) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-heading text-3xl">Your review</h1>
          <p className="text-muted-foreground text-sm">
            {visit.restaurantName} · rate this visit independently from your
            partner.
          </p>
        </div>
        <Link
          href={`/visits/${visit.id}`}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
        >
          Cancel
        </Link>
      </div>
      <RateVisitForm
        visitId={visit.id}
        dishes={visit.orderedItems.map((i) => ({
          id: i.id,
          dishName: i.dishName,
        }))}
      />
    </div>
  );
}
