import { ImportForm } from "@/components/plans/import-form";

export default function NewPlanPage() {
  return (
    <div className="flex flex-1 justify-center overflow-y-auto">
      <div className="w-full max-w-[720px] px-6 py-12">
        <h2 className="text-xl font-semibold tracking-tight">New plan</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Paste a markdown plan or upload a <code>.md</code> file. Use{" "}
          <code>## Day N</code> headers and a <code>**Goal:**</code> line per
          day.
        </p>

        <div className="mt-8">
          <ImportForm />
        </div>
      </div>
    </div>
  );
}
