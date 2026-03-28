/**
 * Centralized Environment Configuration
 * All env variables accessed through typed getters
 * Validates on startup, not at runtime
 */

interface EnvironmentConfig {
  // Database
  databaseUrl: string;
  postgresUser: string;
  postgresPassword: string;
  postgresDb: string;

  // Server
  port: number;
  nodeEnv: "development" | "production" | "test";
  clientUrl: string;
  corsOrigin: string;

  // JWT Auth
  jwtSecret: string;
  jwtExpiry: string;

  // Redis/Upstash
  upstashRedisUrl?: string;
  upstashRedisToken?: string;
  hasRedis: boolean;
}

/**
 * Parse and validate environment variables
 * Called at server startup to catch missing config early
 */
function parseEnv(): EnvironmentConfig {
  const nodeEnv = (process.env.NODE_ENV || "development") as
    | "development"
    | "production"
    | "test";
  const port = parseInt(process.env.PORT || "4000", 10);

  // Database configuration
  const databaseUrl = process.env.DATABASE_URL;
  const postgresUser = process.env.POSTGRES_USER || "gridwatch";
  const postgresPassword = process.env.POSTGRES_PASSWORD || "secret";
  const postgresDb = process.env.POSTGRES_DB || "gridwatch";

  // Server/CORS
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:5173";

  // JWT
  const jwtSecret = process.env.JWT_SECRET || "dev-secret-key";
  const jwtExpiry = process.env.JWT_EXPIRY || "24h";

  // Redis
  const upstashRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const hasRedis = !!(upstashRedisUrl && upstashRedisToken);

  // Validation
  if (!databaseUrl && !postgresUser) {
    throw new Error("DATABASE_URL or POSTGRES credentials required");
  }

  if (jwtSecret === "dev-secret-key" && nodeEnv === "production") {
    throw new Error(
      "JWT_SECRET must be set in production (not dev-secret-key)",
    );
  }

  return {
    databaseUrl:
      databaseUrl ||
      `postgresql://${postgresUser}:${postgresPassword}@localhost:5432/${postgresDb}`,
    postgresUser,
    postgresPassword,
    postgresDb,
    port,
    nodeEnv,
    clientUrl,
    corsOrigin,
    jwtSecret,
    jwtExpiry,
    upstashRedisUrl,
    upstashRedisToken,
    hasRedis,
  };
}

// Parse and cache config at module load time
let config: EnvironmentConfig | null = null;

/**
 * Get the parsed environment configuration
 * Cache is populated on first call
 */
export function getEnv(): EnvironmentConfig {
  if (!config) {
    config = parseEnv();
  }
  return config;
}

/**
 * Log all config at startup (for debugging)
 * Masks sensitive values
 */
export function logStartupConfig(): void {
  const env = getEnv();

  console.log("\n═══════════════════════════════════════════════════════");
  console.log("🔧 Environment Configuration");
  console.log("═══════════════════════════════════════════════════════");

  // Server
  console.log("\n[SERVER]");
  console.log(`  PORT: ${env.port}`);
  console.log(`  NODE_ENV: ${env.nodeEnv}`);
  console.log(`  CLIENT_URL: ${env.clientUrl}`);
  console.log(`  CORS_ORIGIN: ${env.corsOrigin}`);

  // Database
  console.log("\n[DATABASE]");
  const dbUrl = env.databaseUrl;
  const dbMasked = dbUrl
    .replace(/:[^:@]*@/, ":****@")
    .replace(/\/.*$/, "/****");
  console.log(`  DATABASE_URL: ${dbMasked}`);
  console.log(`  POSTGRES_DB: ${env.postgresDb}`);

  // JWT
  console.log("\n[JWT AUTH]");
  console.log(
    `  JWT_SECRET: ${env.jwtSecret === "dev-secret-key" ? "(dev-default)" : "****"}`,
  );
  console.log(`  JWT_EXPIRY: ${env.jwtExpiry}`);

  // Redis
  console.log("\n[REDIS/UPSTASH]");
  if (env.hasRedis) {
    const urlMasked = env.upstashRedisUrl?.split("@")[0] + "@****";
    console.log(`  ✅ UPSTASH_REDIS_REST_URL: ${urlMasked}`);
    console.log(`  ✅ UPSTASH_REDIS_REST_TOKEN: ****`);
  } else {
    console.log(`  ⚠️  Redis not configured (caching disabled)`);
  }

  console.log("\n═══════════════════════════════════════════════════════\n");
}

/**
 * Shorthand getters for commonly accessed values
 */
export function isDevelopment(): boolean {
  return getEnv().nodeEnv === "development";
}

export function isProduction(): boolean {
  return getEnv().nodeEnv === "production";
}

export function hasRedisAvailable(): boolean {
  return getEnv().hasRedis;
}
