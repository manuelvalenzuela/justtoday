import { cn } from "@/lib/utils";

export type TodaySummaryProps = {
  dayNumber: number;
  goal: string;
  topics: string[];
  className?: string;
};

export function TodaySummary({
  dayNumber,
  goal,
  topics,
  className,
}: TodaySummaryProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="text-[0.7rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Day {dayNumber}
      </p>
      <p className="text-[1.05rem] font-medium leading-snug tracking-tight text-foreground">
        {goal}
      </p>
      {topics.length > 0 ? (
        <ul className="flex flex-col gap-1.5 pl-4 text-[0.95rem] leading-relaxed text-foreground/90 marker:text-muted-foreground/70 list-disc">
          {topics.map((topic, i) => (
            <li key={i} className="pl-1">
              {topic}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
