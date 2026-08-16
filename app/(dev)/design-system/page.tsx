import { Card } from "@/components/design/card";
import { PersonAvatar, PersonBadge } from "@/components/design/person-avatar";
import { RatingComparisonRow } from "@/components/design/rating-comparison-row";
import { RatingStars } from "@/components/design/rating-stars";
import { TagChip } from "@/components/design/tag-chip";
import { BottomNav } from "@/components/layout/bottom-nav";

const SAMPLE_TAGS = [
  { name: "Date night", category: "VIBE" },
  { name: "Japanese", category: "FOOD_TYPE" },
  { name: "Omakase", category: "METHOD" },
  { name: "Hidden gem", category: "VIBE" },
  { name: "Pasta", category: "FOOD_TYPE" },
  { name: "Wood-fired", category: "METHOD" },
];

export default function DesignSystemPage() {
  return (
    <div className="bg-background min-h-dvh pb-28">
      <div className="mx-auto max-w-lg space-y-10 px-4 pt-8">
        <header className="space-y-2">
          <p className="text-primary text-xs font-medium tracking-wide uppercase">
            Design system
          </p>
          <h1 className="font-heading text-4xl leading-tight">Our Table</h1>
          <p className="text-muted-foreground text-sm">
            Scratch page for primitives. Placeholder content only — not wired to
            live data.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="font-heading text-2xl">Type</h2>
          <Card>
            <p className="font-heading text-3xl">Lyla</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Playfair Display for titles. Figtree for UI, body, and numbers
              like 9.5.
            </p>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-2xl">Color</h2>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["Cream", "bg-background border border-border"],
                ["Card", "bg-card shadow-card"],
                ["Charcoal", "bg-surface-inverse text-surface-inverse-foreground"],
                ["Terracotta", "bg-primary text-primary-foreground"],
                ["Gold", "bg-gold text-foreground"],
                ["Success", "bg-success text-success-foreground"],
              ] as const
            ).map(([label, cls]) => (
              <div
                key={label}
                className={`flex h-16 items-end rounded-2xl p-2 text-xs font-medium ${cls}`}
              >
                {label}
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-2xl">TagChip</h2>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_TAGS.map((tag) => (
              <TagChip key={tag.name} name={tag.name} category={tag.category} />
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-2xl">PersonAvatar</h2>
          <div className="flex flex-wrap items-center gap-4">
            <PersonBadge name="Member 1" index={0} />
            <PersonBadge name="Member 2" index={1} />
            <PersonAvatar name="Member 3" index={2} size="lg" />
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-2xl">RatingStars</h2>
          <Card className="space-y-4">
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Category (1–5)</p>
              <RatingStars value={4} />
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-xs">Overall (0–10)</p>
              <RatingStars value={9.5} scale="overall" size="lg" />
            </div>
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-2xl">Card</h2>
          <Card>
            <p className="font-heading text-xl">Himitsu</p>
            <p className="text-muted-foreground text-sm">Soft-shadow cream card</p>
          </Card>
          <Card inverse>
            <p className="font-heading text-xl">Upcoming</p>
            <p className="text-sm opacity-80">Inverse charcoal surface</p>
          </Card>
        </section>

        <section className="space-y-1">
          <h2 className="font-heading text-2xl">RatingComparisonRow</h2>
          <p className="text-muted-foreground text-sm">
            Signature element — person colors, not terracotta.
          </p>
          <Card className="divide-border divide-y px-4 py-1">
            <div className="flex items-center justify-center gap-8 py-4">
              <PersonBadge name="You" index={0} />
              <PersonBadge name="Partner" index={1} />
            </div>
            <RatingComparisonRow
              label="Food"
              figures={[
                { label: "You", score: 9.5, index: 0 },
                { label: "Partner", score: 9.0, index: 1 },
              ]}
            />
            <RatingComparisonRow
              label="Service"
              figures={[
                { label: "You", score: 8.0, index: 0 },
                { label: "Partner", score: 8.5, index: 1 },
              ]}
            />
            <RatingComparisonRow
              label="Atmosphere"
              figures={[
                { label: "You", score: 9.0, index: 0 },
                { label: "Partner", score: 7.5, index: 1 },
              ]}
            />
          </Card>
        </section>
      </div>
      <BottomNav />
    </div>
  );
}
