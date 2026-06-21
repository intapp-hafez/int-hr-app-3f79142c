/**
 * Post-build script: flattens dist/client and dist/server into dist/
 *
 * Result layout:
 *   dist/
 *     assets/          ← client assets + server assets merged
 *     server.js        ← server entry
 *     <static files>   ← everything else from dist/client
 */
import { cpSync, rmSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const dist = resolve(root, "dist");
const client = resolve(dist, "client");
const server = resolve(dist, "server");

if (!existsSync(client) || !existsSync(server)) {
  console.error("merge-dist: dist/client or dist/server not found — skipping.");
  process.exit(0);
}

// 1. Copy all client files into dist/ (overwrites safely)
cpSync(client, dist, { recursive: true, force: true });

// 2. Copy server assets into dist/assets/ (merge alongside client assets)
const serverAssets = resolve(server, "assets");
if (existsSync(serverAssets)) {
  cpSync(serverAssets, resolve(dist, "assets"), { recursive: true, force: true });
}

// 3. Copy server.js into dist/
const serverEntry = resolve(server, "server.js");
if (existsSync(serverEntry)) {
  cpSync(serverEntry, resolve(dist, "server.js"), { force: true });
}

// 4. Remove the now-redundant subdirectories
rmSync(client, { recursive: true, force: true });
rmSync(server, { recursive: true, force: true });

console.log("✅ merge-dist: dist/client + dist/server merged into dist/");
