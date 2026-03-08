import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: () =>
        new Response("OK", {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store, max-age=0",
            Pragma: "no-cache",
            "X-Content-Type-Options": "nosniff",
          },
        }),
    },
  },
});
