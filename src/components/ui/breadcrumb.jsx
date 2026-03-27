import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { ChevronRight, MoreHorizontal } from "lucide-react"

import { cn } from "@/lib/utils"

/** @type {import("react").ForwardRefExoticComponent<import("react").ComponentPropsWithoutRef<"nav"> & import("react").RefAttributes<HTMLElement>>} */
const Breadcrumb = React.forwardRef(
  ({ ...props }, ref) => <nav ref={ref} aria-label="breadcrumb" {...props} />
)
Breadcrumb.displayName = "Breadcrumb"

/** @type {import("react").ForwardRefExoticComponent<import("react").ComponentPropsWithoutRef<"ol"> & import("react").RefAttributes<HTMLOListElement>>} */
const BreadcrumbList = React.forwardRef(({ className, ...props }, ref) => (
  <ol
    ref={ref}
    className={cn(
      "flex flex-wrap items-center gap-1.5 break-words text-sm text-muted-foreground sm:gap-2.5",
      className
    )}
    {...props} />
))
BreadcrumbList.displayName = "BreadcrumbList"

/** @type {import("react").ForwardRefExoticComponent<import("react").ComponentPropsWithoutRef<"li"> & import("react").RefAttributes<HTMLLIElement>>} */
const BreadcrumbItem = React.forwardRef(({ className, ...props }, ref) => (
  <li
    ref={ref}
    className={cn("inline-flex items-center gap-1.5", className)}
    {...props} />
))
BreadcrumbItem.displayName = "BreadcrumbItem"

/**
 * @typedef {Object} BreadcrumbLinkProps
 * @property {boolean} [asChild]
 */

/** @type {import("react").ForwardRefExoticComponent<import("react").ComponentPropsWithoutRef<"a"> & BreadcrumbLinkProps & import("react").RefAttributes<HTMLAnchorElement>>} */
const BreadcrumbLink = React.forwardRef(({ asChild, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a"

  return (
    (<Comp
      ref={ref}
      className={cn("transition-colors hover:text-foreground", className)}
      {...props} />)
	);
})
BreadcrumbLink.displayName = "BreadcrumbLink"

/** @type {import("react").ForwardRefExoticComponent<import("react").ComponentPropsWithoutRef<"span"> & import("react").RefAttributes<HTMLSpanElement>>} */
const BreadcrumbPage = React.forwardRef(({ className, ...props }, ref) => (
  <span
    ref={ref}
    role="link"
    aria-disabled="true"
    aria-current="page"
    className={cn("font-normal text-foreground", className)}
    {...props} />
))
BreadcrumbPage.displayName = "BreadcrumbPage"

/**
 * @param {import("react").ComponentPropsWithoutRef<"li"> & { children?: import("react").ReactNode }} props
 */
const BreadcrumbSeparator = ({ children, className, ...props }) => (
  <li
    role="presentation"
    aria-hidden="true"
    className={cn("[&>svg]:w-3.5 [&>svg]:h-3.5", className)}
    {...props}>
    {children ?? <ChevronRight />}
  </li>
)
BreadcrumbSeparator.displayName = "BreadcrumbSeparator"

/**
 * @param {import("react").ComponentPropsWithoutRef<"span">} props
 */
const BreadcrumbEllipsis = ({ className, ...props }) => (
  <span
    role="presentation"
    aria-hidden="true"
    className={cn("flex h-9 w-9 items-center justify-center", className)}
    {...props}>
    <MoreHorizontal className="h-4 w-4" />
    <span className="sr-only">More</span>
  </span>
)
BreadcrumbEllipsis.displayName = "BreadcrumbElipssis"

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
