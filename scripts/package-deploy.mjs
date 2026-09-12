import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir = process.cwd();
const distDir = path.join(rootDir, "dist");
const publicDir = path.join(rootDir, "public");
const zipPath = path.join(rootDir, "deploy_cpanel_hpanel_iis.zip");

console.log("📦 Preparing deployment package for cPanel, hPanel, and IIS...\n");

// 1. Ensure dist exists
if (!fs.existsSync(distDir)) {
  console.log("⚡ Building project first...");
  execSync("npm run build", { stdio: "inherit" });
}

// 2. Ensure critical server config files exist in dist
const filesToSync = [".htaccess", "htaccess.txt", "web.config"];
for (const file of filesToSync) {
  const src = path.join(publicDir, file);
  const dest = path.join(distDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`✓ Copied ${file} -> dist/${file}`);
  } else {
    console.warn(`⚠️ Warning: ${file} not found in public/`);
  }
}

// 3. Compress using PowerShell with -Force to guarantee hidden files like .htaccess are included
console.log("\n🗜️ Creating deploy_cpanel_hpanel_iis.zip (including hidden .htaccess)...");
if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

try {
  execSync(
    `powershell -Command "Get-ChildItem -Force dist | Compress-Archive -DestinationPath '${zipPath}' -Force"`,
    { stdio: "inherit" }
  );
  console.log(`\n🎉 Success! Created: ${zipPath}`);
  console.log(`\nDeployment instructions:`);
  console.log(`1. Upload deploy_cpanel_hpanel_iis.zip to your hosting (cPanel public_html, hPanel public_html, or IIS wwwroot).`);
  console.log(`2. Click 'Extract'.`);
  console.log(`3. Ensure .htaccess is present in public_html (enable 'Show Hidden Files' in cPanel File Manager).`);
  console.log(`   (If your hosting blocks .htaccess, rename htaccess.txt to .htaccess).`);
} catch (err) {
  console.error("Failed to create zip:", err);
  process.exit(1);
}
