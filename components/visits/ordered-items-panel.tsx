import { ThumbsUp } from "lucide-react";
import { Card } from "@/components/design/card";
import { cn } from "@/lib/utils";
import { OrderedAddItemForm } from "@/components/visits/ordered-add-item-form";

export type OrderedItemView = {
  id: string;
  dishName: string;
  price: string | null;
  shared: boolean;
  wouldOrderAgain: boolean | null;
};

function money(value: string | null | undefined) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : value;
}

export function OrderedItemsPanel({
  visitId,
  items,
  currentUserId,
}: {
  visitId: string;
  items: OrderedItemView[];
  currentUserId: string;
}) {
  return (
    <Card className="p-5">
      <h1 className="text-lg font-semibold">Ordered Items</h1>

      {items.length > 0 ? (
        <ul className="divide-border mt-3 divide-y">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3 py-4">
              <span
                className="bg-muted size-14 shrink-0 rounded-xl"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="font-semibold">{item.dishName}</p>
                  {money(item.price) ? (
                    <span className="text-sm font-medium tabular-nums">
                      {money(item.price)}
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
                      item.shared
                        ? "bg-chip-lavender text-chip-lavender-foreground"
                        : "bg-chip-peach text-chip-peach-foreground",
                    )}
                  >
                    {item.shared ? "Shared" : "Individual"}
                  </span>
                  {item.wouldOrderAgain ? (
                    <span className="text-success inline-flex items-center gap-1 text-xs font-medium">
                      Would order again
                      <ThumbsUp className="size-3.5" />
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        className={cn(items.length > 0 ? "border-border border-t pt-4" : "pt-5")}
      >
        <OrderedAddItemForm visitId={visitId} currentUserId={currentUserId} />
      </div>
    </Card>
  );
}
