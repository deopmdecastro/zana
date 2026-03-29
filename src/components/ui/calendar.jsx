import * as React from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { DayPicker } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  fixedWeeks = true,
  ...props
}) {
  return (
    (<DayPicker
      showOutsideDays={showOutsideDays}
      fixedWeeks={fixedWeeks}
      className={cn("p-2 w-full max-w-full", className)}
      classNames={{
        months: "flex flex-col gap-4 w-full min-w-0",
        month: "space-y-3 w-full min-w-0",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium capitalize tracking-wide",
        nav: "space-x-1 flex items-center",
        nav_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-8 w-8 rounded-full p-0 opacity-70 hover:opacity-100 hover:bg-accent/60"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full table-fixed border-collapse",
        head_row: "grid grid-cols-7 gap-2",
        head_cell:
          "text-muted-foreground/80 rounded-md text-center font-medium text-[0.70rem] uppercase tracking-widest h-7 flex items-center justify-center",
        row: "grid grid-cols-7 gap-2 mt-2",
        cell: cn(
          "relative p-0 text-center text-sm min-w-0 flex items-center justify-center focus-within:relative focus-within:z-20",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md"
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "relative w-full aspect-square p-0 font-normal aria-selected:opacity-100 rounded-md leading-none min-w-0"
        ),
        day_range_start: "day-range-start",
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-sm",
        day_today: "ring-1 ring-primary/30",
        day_outside:
          "day-outside text-muted-foreground/40 aria-selected:text-muted-foreground/60",
        day_disabled: "text-muted-foreground/40 opacity-50",
        day_range_middle:
          "aria-selected:bg-primary/15 aria-selected:text-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("h-4 w-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("h-4 w-4", className)} {...props} />
        ),
      }}
      {...props} />)
  );
}
Calendar.displayName = "Calendar"

export { Calendar }
