"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const VARIANTS = [
  "justtoday helps you stick to a study plan by giving you one day at a time. Tell it what you're learning and it adapts as you go.",
  "A chat-based study tracker that breaks your goal into days. Check in each day, talk through what you covered, and the plan adjusts.",
  "Pick something to learn — Spanish, English, anything. justtoday turns it into a day-by-day plan and keeps the conversation in your language.",
  "Study plans that move at your pace. Tell it how today went — it shapes tomorrow around that.",
  "One day at a time, in a conversation. justtoday keeps your study plan honest and adapts when life gets in the way.",
];

const ROTATION_MS = 6000;

export function RotatingIntro() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setIndex((i) => (i + 1) % VARIANTS.length);
    }, ROTATION_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="mt-3 grid">
      {VARIANTS.map((variant, i) => (
        <p
          key={i}
          aria-hidden={i !== index}
          className={cn(
            "col-start-1 row-start-1 text-center text-sm leading-relaxed text-muted-foreground transition-opacity duration-300 ease-out",
            i === index ? "opacity-100 delay-300" : "opacity-0",
          )}
        >
          {variant}
        </p>
      ))}
    </div>
  );
}
