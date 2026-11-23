import type React from "react";
import { cn } from "@/lib/utils";

/**
 * <select> nativo com a aparência do gatilho do Select do coss ui.
 * Mantemos o nativo para o seletor do sistema no celular e para os testes
 * (selectOptions/selectOption) que já dependem dele.
 */
export function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">): React.ReactElement {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-9 w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-input bg-background bg-size-[16px] bg-position-[right_0.625rem_center] bg-no-repeat select-chevron py-0 ps-[calc(--spacing(3)-1px)] pe-9 text-base text-foreground shadow-xs/5 outline-none ring-ring/24 transition-shadow focus-visible:border-ring focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-64 aria-invalid:border-destructive/36 sm:h-8 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
