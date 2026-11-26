import { BookOpen } from "lucide-react";

export function Brand() {
  return (
    <span className="inline-flex items-center gap-2.5 text-foreground">
      <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
        <BookOpen className="size-4" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-[17px] font-semibold tracking-tight">labrary</span>
        <span className="mt-0.5 text-[9px] font-medium tracking-[0.24em] text-subtle-foreground">
          DIGITAL
        </span>
      </span>
    </span>
  );
}
