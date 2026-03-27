"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"

import { cn } from "@/lib/utils"

/** @type {import("react").ForwardRefExoticComponent<import("react").ComponentPropsWithoutRef<typeof AvatarPrimitive.Root> & import("react").RefAttributes<import("react").ElementRef<typeof AvatarPrimitive.Root>>>} */
const Avatar = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props} />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

/** @type {import("react").ForwardRefExoticComponent<import("react").ComponentPropsWithoutRef<typeof AvatarPrimitive.Image> & import("react").RefAttributes<import("react").ElementRef<typeof AvatarPrimitive.Image>>>} */
const AvatarImage = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image
    ref={ref}
    className={cn("aspect-square h-full w-full", className)}
    {...props} />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

/** @type {import("react").ForwardRefExoticComponent<import("react").ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback> & import("react").RefAttributes<import("react").ElementRef<typeof AvatarPrimitive.Fallback>>>} */
const AvatarFallback = React.forwardRef(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props} />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName

export { Avatar, AvatarImage, AvatarFallback }
