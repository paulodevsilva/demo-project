export function buildSecurityHeaders() {
  const runtimeEnv = process.env.VITE_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
  const isDevelopment = runtimeEnv !== "production";

  const contentSecurityPolicy = isDevelopment
    ? "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; " +
      "img-src 'self' data: blob:; " +
      "connect-src 'self' https: wss: ws: http://localhost:* http://127.0.0.1:*;"
    : "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; " +
      "script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' https: wss:";

  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    "Content-Security-Policy": contentSecurityPolicy,
  };

  if (process.env.NODE_ENV === "production") {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
  }

  return headers;
}
