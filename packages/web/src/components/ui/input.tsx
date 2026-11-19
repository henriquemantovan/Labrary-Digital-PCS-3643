import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground placeholder:text-subtle-foreground transition-colors focus-visible:border-foreground focus-visible:outline-none disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, "h-10 py-0", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea className={cn(fieldClass, "min-h-20 py-2", className)} {...props} />
  );
}

export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        fieldClass,
        "h-10 cursor-pointer appearance-none py-0 select-chevron bg-size-[16px] bg-position-[right_0.75rem_center] bg-no-repeat pr-9",
        className,
      )}
      {...props}
    />
  );
}

export const fieldLabel = "grid gap-1.5 text-sm font-medium";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("text-sm font-medium", className)} {...props} />;
}
