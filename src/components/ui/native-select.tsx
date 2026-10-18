import * as React from "react"
import { cn } from "cn"

/** Sunucu aksiyonlarına `FormData` ile giden formlar için yerel `<select>` (bkz. select.tsx: base-ui). */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="native-select"
      className={cn(
        "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 text-foreground dark:bg-input/30 dark:[color-scheme:dark] [&_option]:bg-popover [&_option]:text-popover-foreground [&_optgroup]:bg-popover [&_optgroup]:text-popover-foreground",
        className
      )}
      {...props}
    />
  )
}

export { NativeSelect }
