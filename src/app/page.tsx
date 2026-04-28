import { AppShell } from "@/components/layout/app-shell";

export default function Home() {
  return (
    <AppShell>
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-[720px] px-6 py-12 text-center">
          <h2 className="text-xl font-semibold tracking-tight">Today</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Load a plan to get started.
          </p>
        </div>
      </div>
    </AppShell>
  );
}
