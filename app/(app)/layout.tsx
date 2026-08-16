import { BottomNav } from "@/components/layout/bottom-nav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background min-h-dvh pb-24">
      <div className="mx-auto max-w-lg px-4 pt-6">{children}</div>
      <BottomNav />
    </div>
  );
}
