import "dotenv/config";
import mysql from "mysql2/promise";
import { hashPassword } from "./auth.password";

async function main() {
  const connectionUri = process.env.DATABASE_URL;
  if (!connectionUri) {
    console.error("[Reset] No DATABASE_URL found.");
    process.exit(1);
  }

  console.log("[Reset] Connecting to operational database...");
  const pool = mysql.createPool({
    uri: connectionUri,
    ssl: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 10,
    connectTimeout: 15000,
  });

  const conn = await pool.getConnection();

  try {
    console.log("[Reset] Step 1: Clearing all active incidents and cases...");
    // Clear in proper foreign key dependency order
    await conn.query("DELETE FROM `postRescueCheckIns`").catch(() => {});
    await conn.query("DELETE FROM `hospitalCaseNotifications`").catch(() => {});
    await conn.query("DELETE FROM `incidentMessages`").catch(() => {});
    await conn.query("DELETE FROM `missionOffers`").catch(() => {});
    await conn.query("DELETE FROM `missions`").catch(() => {});
    await conn.query("DELETE FROM `incidentEvents`").catch(() => {});
    await conn.query("DELETE FROM `incidents`").catch(() => {});
    console.log("[Reset] Incidents, missions, offers, and case tracking tables cleared.");

    console.log("[Reset] Step 2: Cleaning old/fake rescuer records...");
    await conn.query("DELETE FROM `rescuerCapabilities`").catch(() => {});
    await conn.query("DELETE FROM `rescuerRegistrationRequests`").catch(() => {});
    await conn.query("DELETE FROM `rescueProfiles`").catch(() => {});
    await conn.query("DELETE FROM `users` WHERE `role` = 'rescuer'").catch(() => {});
    console.log("[Reset] Old rescuer profiles, capabilities, and fake accounts removed.");

    console.log("[Reset] Step 3: Ensuring active Government Access Code for Rescuers exists...");
    const rescuerCodeHash = hashPassword("RESCUER-2026");
    await conn.query(
      "INSERT INTO `roleAccessCodes` (`role`, `codeHash`, `codeVersion`, `updatedAt`) VALUES ('rescuer', ?, 1, NOW()) ON DUPLICATE KEY UPDATE `codeHash` = ?, `codeVersion` = 1, `updatedAt` = NOW()",
      [rescuerCodeHash, rescuerCodeHash]
    );

    console.log("[Reset] Step 4: Creating 3 fresh, classified single rescuer accounts...");

    const classifiedRescuers = [
      {
        openId: "user-rescuer-medical",
        name: "Dr. Rupam Hazarika",
        email: "rescuer.medical@assamrescue.gov.in",
        rawPassword: "Medic@2026Assam",
        callSign: "SDRF-MEDIC-01",
        category: "medical" as const,
        phone: "+91 94350 11221",
        lat: 26.1558,
        lng: 91.7645,
        capabilities: [
          { capability: "medical", priority: 1 },
          { capability: "general_emergency", priority: 2 },
        ],
      },
      {
        openId: "user-rescuer-boat",
        name: "Commander Bikram Kalita",
        email: "rescuer.boat@assamrescue.gov.in",
        rawPassword: "Boat@2026Assam",
        callSign: "NDRF-BOAT-01",
        category: "boat" as const,
        phone: "+91 94350 22332",
        lat: 26.1850,
        lng: 91.7450,
        capabilities: [
          { capability: "flood_rescue", priority: 1 },
          { capability: "evacuation", priority: 2 },
        ],
      },
      {
        openId: "user-rescuer-ground",
        name: "Inspector Debajit Bora",
        email: "rescuer.ground@assamrescue.gov.in",
        rawPassword: "Ground@2026Assam",
        callSign: "QRF-GROUND-01",
        category: "ground-team" as const,
        phone: "+91 94350 33443",
        lat: 26.1400,
        lng: 91.7900,
        capabilities: [
          { capability: "trapped_rescue", priority: 1 },
          { capability: "evacuation", priority: 2 },
        ],
      },
    ];

    for (const r of classifiedRescuers) {
      const hashedPassword = hashPassword(r.rawPassword);

      // Insert User
      const [userResult]: any = await conn.query(
        `INSERT INTO \`users\` (\`openId\`, \`name\`, \`email\`, \`password\`, \`role\`, \`status\`, \`loginMethod\`, \`createdAt\`, \`updatedAt\`, \`lastSignedIn\`)
         VALUES (?, ?, ?, ?, 'rescuer', 'active', 'platform-login', NOW(), NOW(), NOW())
         ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`), \`password\` = VALUES(\`password\`), \`role\` = 'rescuer', \`status\` = 'active', \`updatedAt\` = NOW()`,
        [r.openId, r.name, r.email, hashedPassword]
      );

      // Get inserted or existing user ID
      const [userRows]: any = await conn.query("SELECT `id` FROM `users` WHERE `email` = ? AND `role` = 'rescuer'", [r.email]);
      const userId = userRows[0]?.id || userResult.insertId;

      // Insert Rescue Profile
      await conn.query(
        `INSERT INTO \`rescueProfiles\` (\`userId\`, \`callSign\`, \`phone\`, \`category\`, \`availability\`, \`contactSharing\`, \`locationSharing\`, \`lastLatitude\`, \`lastLongitude\`, \`locationUpdatedAt\`, \`updatedAt\`)
         VALUES (?, ?, ?, ?, 'available', 'yes', 'yes', ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE \`callSign\` = VALUES(\`callSign\`), \`phone\` = VALUES(\`phone\`), \`category\` = VALUES(\`category\`), \`availability\` = 'available', \`lastLatitude\` = VALUES(\`lastLatitude\`), \`lastLongitude\` = VALUES(\`lastLongitude\`), \`updatedAt\` = NOW()`,
        [userId, r.callSign, r.phone, r.category, r.lat, r.lng]
      );

      // Insert Rescuer Capabilities
      for (const cap of r.capabilities) {
        await conn.query(
          `INSERT INTO \`rescuerCapabilities\` (\`rescuerId\`, \`capability\`, \`priority\`, \`active\`, \`createdAt\`, \`updatedAt\`)
           VALUES (?, ?, ?, 'yes', NOW(), NOW())
           ON DUPLICATE KEY UPDATE \`priority\` = VALUES(\`priority\`), \`active\` = 'yes', \`updatedAt\` = NOW()`,
          [userId, cap.capability, cap.priority]
        );
      }

      console.log(`[Reset] Created classified rescuer: ${r.name} (${r.callSign}) -> ${r.email}`);
    }

    console.log("[Reset] All operations completed successfully!");
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("[Reset] Error during reset:", err);
  process.exit(1);
});
