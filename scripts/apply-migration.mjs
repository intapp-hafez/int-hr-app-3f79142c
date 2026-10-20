/**
 * apply-migration.mjs
 * Applies the anti-spoofing hardening SQL migration to the linked Supabase project
 * using the Supabase Management API.
 * Run: node scripts/apply-migration.mjs
 */
import { readFileSync } from "fs";
import https from "https";

import { existsSync } from "fs";

const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID ?? "hydakxwzpfzwolencnmp";

let SERVICE_ROLE_KEY = process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY ?? "";
if (!SERVICE_ROLE_KEY && existsSync(".env.local")) {
  const envContent = readFileSync(".env.local", "utf8");
  const match = envContent.match(/ADMIN_SUPABASE_SERVICE_ROLE_KEY="?([^"\r\n]+)"?/);
  if (match) SERVICE_ROLE_KEY = match[1];
}

const sqlFile = process.argv[2] ?? "supabase/migrations/20261020010000_anti_spoofing_hardening.sql";
const sql = readFileSync(sqlFile, "utf8");
const body = JSON.stringify({ query: sql });

const options = {
  hostname: "api.supabase.com",
  path: `/v1/projects/${SUPABASE_PROJECT_ID}/database/query`,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Length": Buffer.byteLength(body),
  },
};

const req = https.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => (data += chunk));
  res.on("end", () => {
    console.log(`HTTP ${res.statusCode}`);
    try {
      const parsed = JSON.parse(data);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log("✅ Migration applied successfully");
        console.log(JSON.stringify(parsed, null, 2));
      } else {
        console.error("❌ Error:", JSON.stringify(parsed, null, 2));
        process.exit(1);
      }
    } catch {
      console.log(data.slice(0, 1000));
    }
  });
});

req.on("error", (e) => { console.error("Request failed:", e.message); process.exit(1); });
req.write(body);
req.end();
