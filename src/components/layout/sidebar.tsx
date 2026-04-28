import { ThemeToggle } from "@/components/theme-toggle";

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-4 border-b">
        <h1 className="text-base font-semibold tracking-tight">justtoday</h1>
      </div>
      <div className="flex-1 px-3 py-4">
        <h2 className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Plans
        </h2>
        <p className="mt-3 px-2 text-sm text-muted-foreground">No plans yet.</p>
      </div>
      <div className="px-3 py-3 border-t">
        <ThemeToggle />
      </div>
    </aside>
  );
}
