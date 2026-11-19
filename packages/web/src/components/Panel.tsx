import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/utils";

/** Seção do detalhe do projeto: cartão branco com título e resumo opcional. */
export function Panel({
  heading,
  aside,
  className,
  children,
  ...props
}: ComponentProps<"section"> & { heading: ReactNode; aside?: ReactNode }) {
  return (
    <section
      className={cn("rounded-xl border bg-card p-5 md:p-6", className)}
      {...props}
    >
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {heading}
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export const panelClass =
  "grid min-w-0 content-start gap-4 rounded-xl border bg-card p-5 md:p-6 [overflow-wrap:anywhere]";
export const blockClass = "grid min-w-0 content-start gap-3 rounded-lg border p-4";
export const sectionHeading =
  "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 [&>span]:text-xs [&>span]:text-muted-foreground";
export const buttonRow = "flex flex-wrap items-center gap-2";
export const panelTitle = "text-base font-semibold tracking-tight";
export const subTitle = "text-sm font-semibold";
export const mutedText = "text-sm text-muted-foreground";
export const hintText = "text-xs text-muted-foreground";
export const listBox = "divide-y rounded-lg border";
export const lockNote =
  "flex items-start gap-2 rounded-lg bg-muted px-3.5 py-2.5 text-sm text-muted-foreground [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0";
export const progressBar =
  "h-1.5 flex-1 appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary";
export const fileInput =
  "block w-full text-sm text-muted-foreground file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground";
export const detailsBox =
  "rounded-lg border bg-card [&>summary]:cursor-pointer [&>summary]:px-4 [&>summary]:py-3 [&>summary]:text-sm [&>summary]:font-medium [&[open]>summary]:border-b";
export const checkRow = "flex items-start gap-2 text-sm [&>input]:mt-0.5 [&>input]:size-4";
