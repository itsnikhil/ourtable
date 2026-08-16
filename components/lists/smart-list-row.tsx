import Link from "next/link";
import type { DEFAULT_SMART_LISTS } from "@/lib/smart-lists";
import { SMART_LIST_PRESENTATION } from "@/components/lists/smart-list-presentation";

type SmartList = (typeof DEFAULT_SMART_LISTS)[number];

export function SmartListRow({ list }: { list: SmartList }) {
  const { circle, Icon, description } =
    SMART_LIST_PRESENTATION[list.smartRule.key];

  return (
    <Link
      href={`/lists/${list.smartRule.key}`}
      className="flex items-center gap-3 px-4 py-3.5"
    >
      <span
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-white"
        style={{ backgroundColor: circle }}
        aria-hidden
      >
        <Icon className="size-5 fill-white" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-foreground">{list.name}</span>
        <span className="text-muted-foreground mt-0.5 block text-sm">
          {description}
        </span>
        <span className="text-muted-foreground mt-0.5 block text-sm">
          Coming soon
        </span>
      </span>
    </Link>
  );
}
