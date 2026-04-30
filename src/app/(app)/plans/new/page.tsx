import { NewPlanFlow } from "@/components/plans/new-plan-flow";

export default function NewPlanPage() {
  return (
    <div className="flex flex-1 justify-center overflow-y-auto">
      <div className="w-full max-w-[720px] px-6 py-12">
        <h2 className="text-xl font-semibold tracking-tight">New plan</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste anything — a structured outline, a ChatGPT plan, or just a few
          sentences. I&apos;ll turn it into a day-by-day plan you can edit
          before saving.
        </p>

        <div className="mt-8">
          <NewPlanFlow />
        </div>
      </div>
    </div>
  );
}
