import { logoutServerFn } from "@/lib/auth.server";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { LoaderCircle, LogOut } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/logout")({
  component: LogoutPage,
});

function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    let isActive = true;

    const run = async () => {
      const startedAt = Date.now();
      await logoutServerFn();
      const elapsed = Date.now() - startedAt;
      const minimumDurationMs = 450;
      if (elapsed < minimumDurationMs) {
        await new Promise((resolve) => setTimeout(resolve, minimumDurationMs - elapsed));
      }
      if (isActive) {
        router.navigate({ to: "/sign-in" });
      }
    };

    run();
    return () => {
      isActive = false;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="animate-rise-in w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 rounded-full bg-slate-100 p-3 text-slate-700">
            <LogOut className="h-6 w-6" />
          </div>
          <CardTitle className="text-xl">Signing out</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center gap-2 text-sm text-slate-600">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          <span>Please wait...</span>
        </CardContent>
      </Card>
    </div>
  );
}
