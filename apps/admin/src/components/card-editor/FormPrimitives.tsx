"use client";

import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export function Field({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && <FieldError message={error} />}
    </div>
  );
}

export function FieldError({ message }: { message: string }) {
  return <p className="text-xs text-destructive">{message}</p>;
}

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cn(
        "w-full border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring capitalize",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
});
