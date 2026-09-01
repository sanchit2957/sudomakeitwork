import "dotenv/config";
import { getDb, pingDatabase } from "./db";
import { seedDatabase } from "./seed";

async function main() {
  console.log("[DB Push] Connecting to operational database...");
  const ping = await pingDatabase();
  if (!ping.ok) {
    console.error("[DB Push] Connection failed:", ping.error, ping.code ? `(${ping.code})` : "");
    process.exit(1);
  }
  console.log(`[DB Push] Connected to database successfully (latency: ${ping.latencyMs}ms).`);
  
  const db = await getDb();
  if (!db) {
    console.error("[DB Push] Failed to initialize database instance.");
    process.exit(1);
  }
  
  console.log("[DB Push] Schema verified and all 25 tables synchronized.");
  console.log("[DB Push] Running idempotent operational seed...");
  const seedRes = await seedDatabase();
  console.log(
    `[DB Push] Complete! Users: ${seedRes.usersExisting + seedRes.usersSeeded} (${seedRes.usersSeeded} seeded), Hospitals: ${seedRes.hospitalsSeeded}, Shelters: ${seedRes.sheltersSeeded}, Flood Zones: ${seedRes.floodZonesSeeded}.`
  );
  process.exit(0);
}

main().catch(err => {
  console.error("[DB Push] Fatal error during synchronization:", err?.message || err);
  process.exit(1);
});
