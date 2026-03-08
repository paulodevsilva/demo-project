import { PrismaPg } from "@prisma/adapter-pg";
import type { PrismaClient as PrismaClientType } from "@prisma/client";
import { getServerConfigServerFn } from "./get-server-config.server";
import { logSecurityWarning } from "./observability.server";

type PgPoolLike = {
  on: (event: string, listener: (error: Error) => void) => void;
  end: () => Promise<void>;
};

type PrismaState = {
  client: PrismaClientType | null;
  pool: PgPoolLike | null;
  handlersRegistered: boolean;
};

const globalPrismaState = globalThis as typeof globalThis & {
  __demoProjectPrismaState?: PrismaState;
};

const prismaState: PrismaState =
  globalPrismaState.__demoProjectPrismaState ??
  (globalPrismaState.__demoProjectPrismaState = {
    client: null,
    pool: null,
    handlersRegistered: false,
  });

function parseEnvInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildPoolConfig(connectionString: string) {
  return {
    connectionString,
    max: parseEnvInt("DB_POOL_MAX", 10),
    idleTimeoutMillis: parseEnvInt("DB_POOL_IDLE_TIMEOUT_MS", 10_000),
    connectionTimeoutMillis: parseEnvInt("DB_POOL_CONNECTION_TIMEOUT_MS", 5_000),
    maxUses: parseEnvInt("DB_POOL_MAX_USES", 7_500),
    allowExitOnIdle: process.env.NODE_ENV !== "production",
  };
}

async function disconnectPrismaResources() {
  const client = prismaState.client;
  const pool = prismaState.pool;

  prismaState.client = null;
  prismaState.pool = null;

  if (client) {
    await client.$disconnect();
  }

  if (pool) {
    await pool.end();
  }
}

function registerProcessHandlers() {
  if (prismaState.handlersRegistered) return;

  const shutdown = async (signal: string) => {
    try {
      await disconnectPrismaResources();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logSecurityWarning("db.shutdown.disconnect_failed", { signal, message });
    }
  };

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.once("beforeExit", () => {
    void shutdown("beforeExit");
  });

  prismaState.handlersRegistered = true;
}

export const getServerSidePrismaClient = async (): Promise<PrismaClientType> => {
  if (typeof window !== "undefined") {
    throw new Error("getServerSidePrismaClient should only be called on the server");
  }

  if (prismaState.client) {
    return prismaState.client;
  }

  const prismaModule = await import("@prisma/client" as string);
  const PrismaClient = (prismaModule as { PrismaClient?: new (args: { adapter: PrismaPg }) => PrismaClientType }).PrismaClient;

  if (!PrismaClient) {
    throw new Error("Prisma client is not generated. Run `bun run generate` before starting the app.");
  }

  const config = await getServerConfigServerFn();
  const databaseUrl = config.database.url;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  let pool = prismaState.pool;
  if (!pool) {
    const pgModule = (await import("pg" as string)) as { default: { Pool: new (config: object) => PgPoolLike } };
    const poolConfig = buildPoolConfig(databaseUrl);
    pool = new pgModule.default.Pool(poolConfig);
    pool.on("error", (err: Error) => {
      logSecurityWarning("db.pool.idle_error", { message: err.message });
    });
    prismaState.pool = pool;
  }

  const adapter = new PrismaPg(pool, {
    onPoolError: (err) => logSecurityWarning("db.pool.error", { message: err.message }),
    onConnectionError: (err) => logSecurityWarning("db.connection.error", { message: err.message }),
  });

  prismaState.client = new PrismaClient({ adapter });

  registerProcessHandlers();

  return prismaState.client;
};
