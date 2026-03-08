import { cn } from "@/lib/utils";
import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, type = "text", ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={cn(
      "flex h-10 w-full rounded-xl border border-slate-300/85 bg-white/95 px-3 py-2 text-sm text-slate-800 shadow-[0_2px_0_0_rgba(255,255,255,0.65)_inset]",
      "placeholder:text-slate-400",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:border-primary",
      "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export { Input };
export type { InputProps };
