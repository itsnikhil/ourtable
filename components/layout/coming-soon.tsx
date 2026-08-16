export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-2">
      <h1 className="font-heading text-3xl leading-tight">{title}</h1>
      <p className="text-muted-foreground text-sm">
        {description ?? "Coming soon"}
      </p>
    </div>
  );
}
