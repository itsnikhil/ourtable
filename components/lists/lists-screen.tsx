"use client";

import { useState } from "react";
import { Card } from "@/components/design/card";
import { SmartListRow } from "@/components/lists/smart-list-row";
import { DEFAULT_SMART_LISTS } from "@/lib/smart-lists";
import { cn } from "@/lib/utils";

type Tab = "mine" | "smart";

export function ListsScreen() {
  const [tab, setTab] = useState<Tab>("smart");
  const smartCount = DEFAULT_SMART_LISTS.length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <span className="bg-muted text-foreground inline-flex size-8 items-center justify-center rounded-full text-sm font-semibold">
          {smartCount}
        </span>
        <h1 className="text-3xl font-bold tracking-tight">Lists</h1>
      </div>

      <div
        className="bg-muted flex rounded-xl p-1"
        role="tablist"
        aria-label="List type"
      >
        {(
          [
            ["mine", "My Lists"],
            ["smart", "Smart Lists"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-medium",
              tab === id
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "smart" ? (
        <Card className="divide-border divide-y overflow-hidden p-0">
          {DEFAULT_SMART_LISTS.map((list) => (
            <SmartListRow key={list.smartRule.key} list={list} />
          ))}
        </Card>
      ) : (
        <Card className="py-12 text-center">
          <p className="text-muted-foreground text-sm">No custom lists yet</p>
        </Card>
      )}
    </div>
  );
}
