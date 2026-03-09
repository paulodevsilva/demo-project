import { createFileRoute, Link, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { Dumbbell, History, BicepsFlexed, User, LogOut, Scale, LoaderCircle, Apple } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/__index/_layout")({
  component: RouteComponent,
  beforeLoad: ({ context }) => {
    if (!context.user) throw redirect({ to: "/sign-in" });
    return { user: context.user! };
  },
});

const navItems = [
  { to: "/current-workout", label: "Current Workout", icon: Dumbbell },
  { to: "/workout-history", label: "Workout History", icon: History },
  { to: "/movements", label: "Movements", icon: BicepsFlexed },
  { to: "/body-weight", label: "Body Weight", icon: Scale },
  { to: "/nutrition", label: "Nutrition", icon: Apple },
] as const;

function RouteComponent() {
  const { user } = Route.useRouteContext();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await new Promise((resolve) => setTimeout(resolve, 160));
    router.navigate({ to: "/logout" });
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-4">
          <img src="/wordmark.svg" alt="Logo" className="h-6" />
          <div className="hidden items-center gap-2 md:flex">
            <span className="hidden max-w-44 truncate rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 sm:inline">
              {user.name || user.email}
            </span>
            <Button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              variant="ghost"
              size="sm"
              className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900">
              {isSigningOut ? <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogOut className="mr-1.5 h-3.5 w-3.5" />}
              {isSigningOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-4 md:hidden">
          {navItems.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-slate-50 [&.active]:border-transparent [&.active]:bg-primary [&.active]:text-white">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-6 p-4 pb-24 md:h-[calc(100dvh-5.5rem)] md:items-start md:overflow-hidden md:p-6 md:pb-6">
        <nav className="hidden h-full w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/85 p-4 shadow-[0_20px_48px_-38px_rgba(8,47,73,0.45)] backdrop-blur md:flex">
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-slate-100 hover:text-slate-900 [&.active]:bg-slate-900 [&.active]:text-white">
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>
          <div className="mt-4 shrink-0 space-y-2 border-t border-slate-200 pt-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <User className="h-4 w-4" />
              <div className="truncate">
                <p className="text-xs text-slate-400">Logged in as</p>
                <p className="truncate font-medium text-slate-800">{user.name || user.email}</p>
              </div>
            </div>
          </div>
        </nav>
        <main className="min-w-0 flex-1 animate-rise-in md:h-full md:overflow-y-auto md:pr-1">
          <Outlet />
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
        <Button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          variant="outline"
          className="h-11 w-full gap-2 border-slate-300 bg-white text-slate-700">
          {isSigningOut ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          {isSigningOut ? "Signing out..." : "Sign out"}
        </Button>
      </div>

      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-40 bg-slate-900/0 backdrop-blur-0 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isSigningOut && "bg-slate-900/20 backdrop-blur-[2px]",
        )}
      />
    </div>
  );
}
