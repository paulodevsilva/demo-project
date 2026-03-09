import crypto, { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { redirect } from "@tanstack/react-router";
import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { createMiddleware, createServerFn } from "@tanstack/react-start";
import { sessionCookieName } from "./auth.consts";
import { getServerSidePrismaClient } from "./db.server";
import { z } from "zod";
import { logSecurityWarning, withObservation } from "./observability.server";

// In production, use a proper secret from environment variables
const COOKIE_SECRET = process.env.COOKIE_SECRET || "dev-secret-change-in-production";
const SIGN_IN_WINDOW_MS = 10 * 60 * 1000;
const SIGN_IN_MAX_ATTEMPTS = 5;
const SIGN_IN_BLOCK_MS = 15 * 60 * 1000;
const SIGN_IN_RATE_LIMIT_MAX_ENTRIES = 10_000;
const SIGN_IN_PRUNE_INTERVAL_MS = 5 * 60 * 1000;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keylen: 64 };

const signInRateLimits = new Map<string, { attempts: number; firstAttemptAt: number; blockedUntil?: number }>();
let lastSignInMapPruneAt = 0;

if (typeof window === "undefined" && process.env.NODE_ENV === "production" && COOKIE_SECRET === "dev-secret-change-in-production") {
  throw new Error("COOKIE_SECRET must be configured in production.");
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, SCRYPT_PARAMS.keylen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
  return `scrypt$${SCRYPT_PARAMS.N}$${SCRYPT_PARAMS.r}$${SCRYPT_PARAMS.p}$${salt}$${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  const parts = hashedPassword.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") {
    return false;
  }
  const [, n, r, p, salt, hashHex] = parts;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, salt, expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });

  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}

function isAccountLocked(email: string): boolean {
  pruneSignInRateLimits();
  const key = email.toLowerCase();
  const current = signInRateLimits.get(key);
  if (!current) return false;
  if (current.blockedUntil && current.blockedUntil > Date.now()) return true;
  if (current.blockedUntil && current.blockedUntil <= Date.now()) {
    signInRateLimits.delete(key);
  }
  return false;
}

function registerSignInFailure(email: string) {
  pruneSignInRateLimits();
  const key = email.toLowerCase();
  const now = Date.now();
  const current = signInRateLimits.get(key);
  if (!current || now - current.firstAttemptAt > SIGN_IN_WINDOW_MS) {
    signInRateLimits.set(key, { attempts: 1, firstAttemptAt: now });
    return;
  }
  const attempts = current.attempts + 1;
  const next = { ...current, attempts };
  if (attempts >= SIGN_IN_MAX_ATTEMPTS) {
    next.blockedUntil = now + SIGN_IN_BLOCK_MS;
  }
  signInRateLimits.set(key, next);
}

function pruneSignInRateLimits(force = false) {
  const now = Date.now();
  if (!force && now - lastSignInMapPruneAt < SIGN_IN_PRUNE_INTERVAL_MS) {
    return;
  }
  lastSignInMapPruneAt = now;

  for (const [key, entry] of signInRateLimits) {
    const windowExpired = now - entry.firstAttemptAt > SIGN_IN_WINDOW_MS;
    const blockExpired = !entry.blockedUntil || entry.blockedUntil <= now;
    if (windowExpired && blockExpired) {
      signInRateLimits.delete(key);
    }
  }

  if (signInRateLimits.size <= SIGN_IN_RATE_LIMIT_MAX_ENTRIES) {
    return;
  }

  const overflow = signInRateLimits.size - SIGN_IN_RATE_LIMIT_MAX_ENTRIES;
  const entriesByAge = Array.from(signInRateLimits.entries()).sort((a, b) => a[1].firstAttemptAt - b[1].firstAttemptAt);
  for (let index = 0; index < overflow; index += 1) {
    signInRateLimits.delete(entriesByAge[index][0]);
  }
}

function registerSignInSuccess(email: string) {
  signInRateLimits.delete(email.toLowerCase());
}

function secureStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

/**
 * Signs a user ID to create a tamper-proof session token
 */
function signUserId(userId: string): string {
  const signature = crypto.createHmac("sha256", COOKIE_SECRET).update(userId).digest("hex");
  return `${userId}.${signature}`;
}

/**
 * Verifies a signed session token and returns the user ID if valid
 */
function verifySessionToken(token: string): string | null {
  const [userId, signature] = token.split(".");
  if (!userId || !signature) return null;

  const expectedSignature = crypto.createHmac("sha256", COOKIE_SECRET).update(userId).digest("hex");
  if (!secureStringEqual(signature, expectedSignature)) return null;

  return userId;
}

/**
 * Sets the session cookie for a user (internal use only)
 */
function setSessionCookie(userId: string) {
  const token = signUserId(userId);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  setCookie(sessionCookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Gets the current user from session cookie
 * @returns User object or null if not logged in
 */
export const getUserServerFn = createServerFn().handler(async () => {
  return withObservation("auth.getUser", async (observation) => {
    const sessionToken = getCookie(sessionCookieName);
    if (!sessionToken) {
      observation.addMeta({ authenticated: false, reason: "missing_cookie" });
      return null;
    }

    const userId = verifySessionToken(sessionToken);
    if (!userId) {
      observation.addMeta({ authenticated: false, reason: "invalid_session_token" });
      return null;
    }
    observation.setUserId(userId);

    const prisma = await getServerSidePrismaClient();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });
    observation.addMeta({ authenticated: Boolean(user) });
    return user;
  });
});

/**
 * Signs in a user with email and password
 */
export const signInServerFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), password: z.string() }))
  .handler(async ({ data }: { data: { email: string; password: string } }) => {
    return withObservation("auth.signIn", async (observation) => {
      const { email, password } = data;
      const emailDomain = email.includes("@") ? email.split("@")[1] : "unknown";
      observation.addMeta({ emailDomain });

      if (isAccountLocked(email)) {
        logSecurityWarning("auth.signin.blocked", { requestId: observation.requestId, emailDomain });
        observation.addMeta({ outcome: "blocked" });
        return { success: false as const, error: "Too many attempts. Try again in a few minutes." };
      }

      const prisma = await getServerSidePrismaClient();
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        registerSignInFailure(email);
        logSecurityWarning("auth.signin.invalid_user", { requestId: observation.requestId, emailDomain });
        observation.addMeta({ outcome: "invalid_user" });
        return { success: false as const, error: "Invalid email or password" };
      }
      observation.setUserId(user.id);

      let isPasswordValid = false;
      if (user.password.startsWith("scrypt$")) {
        isPasswordValid = await verifyPassword(password, user.password);
      } else {
        // Backwards compatibility: migrate legacy plaintext password on successful login.
        isPasswordValid = secureStringEqual(user.password, password);
        if (isPasswordValid) {
          const hashedPassword = await hashPassword(password);
          await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
          });
          observation.addMeta({ migratedLegacyPassword: true });
        }
      }

      if (!isPasswordValid) {
        registerSignInFailure(email);
        logSecurityWarning("auth.signin.invalid_password", { requestId: observation.requestId, emailDomain });
        observation.addMeta({ outcome: "invalid_password" });
        return { success: false as const, error: "Invalid email or password" };
      }

      registerSignInSuccess(email);
      setSessionCookie(user.id);
      observation.addMeta({ outcome: "success" });

      return { success: true as const };
    });
  });

/**
 * Creates a new user account
 */
export const createAccountServerFn = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), name: z.string().min(1), password: z.string().min(8) }))
  .handler(async ({ data }: { data: { email: string; name: string; password: string } }) => {
    return withObservation("auth.createAccount", async (observation) => {
      const { email, name, password } = data;
      const emailDomain = email.includes("@") ? email.split("@")[1] : "unknown";
      observation.addMeta({ emailDomain });

      const prisma = await getServerSidePrismaClient();

      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        observation.setUserId(existingUser.id);
        observation.addMeta({ outcome: "already_exists" });
        return { success: false as const, error: "An account with this email already exists" };
      }

      const hashedPassword = await hashPassword(password);
      const user = await prisma.user.create({
        data: { email, name, password: hashedPassword },
      });
      observation.setUserId(user.id);
      observation.addMeta({ outcome: "success" });

      setSessionCookie(user.id);
      return { success: true as const };
    });
  });

/**
 * Logs out the current user
 */
export const logoutServerFn = createServerFn({ method: "POST" }).handler(async () =>
  withObservation("auth.logout", async (observation) => {
    const sessionToken = getCookie(sessionCookieName);
    const userId = sessionToken ? verifySessionToken(sessionToken) : null;
    if (userId) {
      observation.setUserId(userId);
    }
    deleteCookie(sessionCookieName);
    return { success: true };
  }),
);

/**
 * Authentication middleware that ensures user is logged in
 * @throws Redirects to sign-in page if not authenticated
 */
export const authMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const user = await getUserServerFn();
  if (!user) {
    logSecurityWarning("auth.middleware.unauthorized");
    throw redirect({ to: "/sign-in" });
  }

  return next({
    context: { user },
  });
});
