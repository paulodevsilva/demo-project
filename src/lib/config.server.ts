export const appConfig = {
  environment: process.env.ENVIRONMENT as "development" | "test" | "staging" | "production",
  database: { url: process.env.DATABASE_URL },
};
