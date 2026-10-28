import * as React from "react"
import { buttonVariants } from "./buttonVariants.js";
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"


function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props} />
  );
}

export { Button }
