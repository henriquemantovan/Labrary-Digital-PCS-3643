import type { ComponentProps, ReactNode } from "react";
import { cn } from "../lib/utils";
import { Card } from "./ui/card";

/** Seção do detalhe do projeto: Card do coss com título e resumo opcional. */
export function Panel({
  heading,
  aside,
  className,
  children,
  ...props
}: ComponentProps<"section"> & { heading: ReactNode; aside?: ReactNode }) {
  return (
    <Card render={<section {...props} />} className={cn("p-5 md:p-6", className)}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        {heading}
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </Card>
  );
}

// Classes para seções montadas direto no markup; seguem o Card e o Alert do coss.
const cardSurface =
  "relative rounded-2xl border bg-card text-card-foreground shadow-xs/5 not-dark:bg-clip-padding before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)]";
export const panelClass = cn(
  cardSurface,
  "grid min-w-0 content-start gap-4 p-5 md:p-6 [overflow-wrap:anywhere]",
);
export const blockClass = "grid min-w-0 content-start gap-3 rounded-xl border bg-background p-4";
export const sectionHeading =
  "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 [&>span]:text-xs [&>span]:text-muted-foreground";
export const buttonRow = "flex flex-wrap items-center gap-2";
export const panelTitle = "font-heading text-base font-semibold";
export const subTitle = "text-sm font-semibold";
export const mutedText = "text-sm text-muted-foreground";
export const hintText = "text-xs text-muted-foreground";
export const listBox = "divide-y rounded-xl border";
export const lockNote =
  "flex items-start gap-2 rounded-xl border bg-muted/50 px-3.5 py-3 text-sm text-muted-foreground [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0";
export const progressBar =
  "h-1.5 flex-1 appearance-none overflow-hidden rounded-full bg-muted [&::-moz-progress-bar]:bg-primary [&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary";
export const fileInput =
  "block w-full text-sm text-muted-foreground file:me-3 file:cursor-pointer file:rounded-md file:border file:border-input file:bg-background file:px-2.5 file:py-1 file:text-sm file:font-medium file:text-foreground file:shadow-xs/5";
export const detailsBox =
  "rounded-xl border bg-card [&>summary]:cursor-pointer [&>summary]:px-4 [&>summary]:py-2.5 [&>summary]:text-sm [&>summary]:font-medium [&[open]>summary]:border-b";
export const checkRow = "flex items-start gap-2 text-sm [&>input]:mt-0.5 [&>input]:size-4";
