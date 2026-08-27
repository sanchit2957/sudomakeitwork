import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

const url = new URL(connectionString.split("?")[0]);

const isRemoteOrTiDB =
  connectionString.includes("tidbcloud.com") ||
  connectionString.includes("ssl=") ||
  !connectionString.includes("localhost");

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: url.hostname,
    port: Number(url.port) || 4000,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    ssl: isRemoteOrTiDB ? { minVersion: "TLSv1.2", rejectUnauthorized: true } : undefined,
  },
});
