import { createHash, randomUUID } from "node:crypto";
import {
  getRequest,
  getRequestHeader,
  getRequestHost,
  getRequestProtocol,
  setResponseHeaders,
} from "@tanstack/react-start/server";
import { buildSecurityHeaders } from "./security-headers";

type LogLevel = "INFO" | "WARN" | "ERROR";
type LogStatus = "ok" | "error";

type LogMeta = Record<string, unknown>;

type InternalState = {
  requestId: string;
  operation: string;
  startedAt: number;
  userHash?: string;
  meta: LogMeta;
};

export type Observation = {
  requestId: string;
  setUserId: (userId: string) => void;
  addMeta: (meta: LogMeta) => void;
};

function anonymizeUserId(userId: string): string {
  return createHash("sha256").update(userId).digest("hex").slice(0, 12);
}

function pickErrorDetails(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack?.split("\n").slice(0, 6).join("\n"),
    };
  }
  return {
    name: "UnknownError",
    message: String(error),
  };
}

function writeLog(level: LogLevel, payload: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    ...payload,
  };
  const line = JSON.stringify(entry);
  if (level === "ERROR") {
    console.error(line);
    return;
  }
  console.log(line);
}

function applySecurityResponseHeaders() {
  setResponseHeaders(buildSecurityHeaders());
}

function getExpectedOrigin(): string {
  const protocol = getRequestProtocol({ xForwardedProto: true }) || "https";
  const host = getRequestHost({ xForwardedHost: true });
  return `${protocol}://${host}`;
}

function extractOriginFromValue(value?: string): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function enforceSameOriginForUnsafeRequest() {
  const request = getRequest();
  const method = request.method.toUpperCase();
  const isUnsafeMethod = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  if (!isUnsafeMethod) return;

  const expectedOrigin = getExpectedOrigin();
  const origin = extractOriginFromValue(getRequestHeader("origin"));
  const refererOrigin = extractOriginFromValue(getRequestHeader("referer"));

  if (origin && origin === expectedOrigin) return;
  if (!origin && refererOrigin && refererOrigin === expectedOrigin) return;

  throw new Response("Forbidden", { status: 403 });
}

export async function withObservation<T>(
  operation: string,
  run: (observation: Observation) => Promise<T>,
  initialMeta: LogMeta = {},
): Promise<T> {
  const slowRequestThresholdMs = Number.parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS ?? "600", 10);
  applySecurityResponseHeaders();
  enforceSameOriginForUnsafeRequest();

  const state: InternalState = {
    requestId: randomUUID(),
    operation,
    startedAt: Date.now(),
    meta: { ...initialMeta },
  };

  const observation: Observation = {
    requestId: state.requestId,
    setUserId: (userId) => {
      state.userHash = anonymizeUserId(userId);
    },
    addMeta: (meta) => {
      state.meta = { ...state.meta, ...meta };
    },
  };

  try {
    const result = await run(observation);
    const durationMs = Date.now() - state.startedAt;
    writeLog("INFO", {
      event: "server.request",
      operation: state.operation,
      requestId: state.requestId,
      status: "ok" satisfies LogStatus,
      durationMs,
      user: state.userHash,
      meta: state.meta,
    });
    if (durationMs > slowRequestThresholdMs) {
      writeLog("WARN", {
        event: "server.request.slow",
        operation: state.operation,
        requestId: state.requestId,
        durationMs,
        user: state.userHash,
      });
    }
    return result;
  } catch (error) {
    writeLog("ERROR", {
      event: "server.request",
      operation: state.operation,
      requestId: state.requestId,
      status: "error" satisfies LogStatus,
      durationMs: Date.now() - state.startedAt,
      user: state.userHash,
      meta: state.meta,
      error: pickErrorDetails(error),
    });
    if (error instanceof Response) {
      throw error;
    }
    if (process.env.NODE_ENV === "production") {
      throw new Error("Request failed");
    }
    throw error;
  }
}

export function logSecurityWarning(event: string, meta: LogMeta = {}) {
  writeLog("WARN", {
    event,
    meta,
  });
}
