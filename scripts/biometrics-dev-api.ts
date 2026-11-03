import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import type { Plugin } from "vite";

export function biometricsDevPlugin(): Plugin {
  return {
    name: "biometrics-dev-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ? req.url.split("?")[0].replace(/\/$/, "") : "";
        if ((req.method === "GET" || req.method === "POST") && (url === "/api/manager-profile" || url.endsWith("/api/manager-profile"))) {
          try {
            const parsedUrl = new URL(req.url || "", "http://localhost");
            const managerId = parsedUrl.searchParams.get("id") || parsedUrl.searchParams.get("manager_id");
            if (!managerId) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Missing manager ID" }));
              return;
            }
            let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
            let serviceKey =
              process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY ||
              process.env.SUPABASE_SERVICE_ROLE_KEY;

            if (!serviceKey || !supabaseUrl) {
              const envLocalPath = path.resolve(process.cwd(), ".env.local");
              if (fs.existsSync(envLocalPath)) {
                const content = fs.readFileSync(envLocalPath, "utf-8");
                const match = content.match(/ADMIN_SUPABASE_SERVICE_ROLE_KEY=["']?([^"'\r\n]+)/);
                if (match) serviceKey = match[1];
              }
              const envPath = path.resolve(process.cwd(), ".env");
              if (fs.existsSync(envPath)) {
                const content = fs.readFileSync(envPath, "utf-8");
                const match = content.match(/SUPABASE_URL=["']?([^"'\r\n]+)/);
                if (match) supabaseUrl = match[1];
              }
            }

            if (!serviceKey || !supabaseUrl) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: "Server missing Supabase service configuration" }));
              return;
            }

            const supabaseAdmin = createClient(supabaseUrl, serviceKey);
            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(managerId);
            const { data: profile } = isUUID
              ? await supabaseAdmin.from("profiles").select("id, full_name, full_name_ar, email, phone, emp_code").or(`id.eq.${managerId},emp_code.eq.${managerId}`).maybeSingle()
              : await supabaseAdmin.from("profiles").select("id, full_name, full_name_ar, email, phone, emp_code").eq("emp_code", managerId).maybeSingle();

            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                ok: true,
                data: profile
                  ? {
                      id: profile.id,
                      full_name: profile.full_name?.trim() || profile.full_name_ar?.trim() || profile.email || profile.emp_code || null,
                      email: profile.email || null,
                      phone: profile.phone || null,
                    }
                  : null,
              })
            );
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: err?.message || "Internal error" }));
            return;
          }
        }

        if (req.method === "POST" && (url === "/api/biometrics/face-login" || url.endsWith("/api/biometrics/face-login"))) {
          let rawBody = "";
          req.on("data", (chunk) => {
            rawBody += chunk;
          });
          req.on("end", async () => {
            try {
              const body = JSON.parse(rawBody);
              const email = String(body.email || "").trim().toLowerCase();
              const descriptor = body.descriptor;
              const userAgent = body.userAgent || (req.headers["user-agent"] as string) || null;
              const ipAddress =
                (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
                req.socket.remoteAddress ||
                null;

              if (!email || !Array.isArray(descriptor) || descriptor.length !== 128) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Invalid email or 128-float vector descriptor" }));
                return;
              }

              // Read Supabase credentials from environment or .env/.env.local
              let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
              let serviceKey =
                process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY ||
                process.env.SUPABASE_SERVICE_ROLE_KEY;

              if (!serviceKey || !supabaseUrl) {
                const envLocalPath = path.resolve(process.cwd(), ".env.local");
                if (fs.existsSync(envLocalPath)) {
                  const content = fs.readFileSync(envLocalPath, "utf-8");
                  const match = content.match(/ADMIN_SUPABASE_SERVICE_ROLE_KEY=["']?([^"'\r\n]+)/);
                  if (match) serviceKey = match[1];
                }
                const envPath = path.resolve(process.cwd(), ".env");
                if (fs.existsSync(envPath)) {
                  const content = fs.readFileSync(envPath, "utf-8");
                  const match = content.match(/SUPABASE_URL=["']?([^"'\r\n]+)/);
                  if (match) supabaseUrl = match[1];
                }
              }

              if (!serviceKey || !supabaseUrl) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Server missing Supabase service configuration" }));
                return;
              }

              const supabaseAdmin = createClient(supabaseUrl, serviceKey);

              // 1. Look up profile
              const { data: profile } = await supabaseAdmin
                .from("profiles")
                .select("id, status")
                .ilike("email", email)
                .maybeSingle();

              if (!profile) {
                await supabaseAdmin.from("biometric_audit_log").insert({
                  email,
                  method: "face",
                  event: "login",
                  success: false,
                  reason: "No account for this email",
                  user_agent: userAgent,
                  ip_address: ipAddress,
                });
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "No account for this email" }));
                return;
              }

              // 2. Check active status
              if ((profile as any).status === "Inactive") {
                await supabaseAdmin.from("biometric_audit_log").insert({
                  user_id: profile.id,
                  email,
                  method: "face",
                  event: "login",
                  success: false,
                  reason: "This account is inactive. Please contact your administrator.",
                  user_agent: userAgent,
                  ip_address: ipAddress,
                });
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "This account is inactive. Please contact your administrator." }));
                return;
              }

              // 3. Look up stored descriptor
              const { data: faceRow } = await supabaseAdmin
                .from("face_descriptors")
                .select("descriptor")
                .eq("user_id", profile.id)
                .maybeSingle();

              if (!faceRow?.descriptor || !Array.isArray(faceRow.descriptor)) {
                await supabaseAdmin.from("biometric_audit_log").insert({
                  user_id: profile.id,
                  email,
                  method: "face",
                  event: "login",
                  success: false,
                  reason: "Face not enrolled for this account",
                  user_agent: userAgent,
                  ip_address: ipAddress,
                });
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: false, error: "Face not enrolled for this account" }));
                return;
              }

              // 4. Calculate Euclidean distance
              const stored = faceRow.descriptor as number[];
              let s = 0;
              for (let i = 0; i < descriptor.length; i++) {
                const d = stored[i] - descriptor[i];
                s += d * d;
              }
              const dist = Math.sqrt(s);

              if (dist > 0.500) {
                await supabaseAdmin.from("biometric_audit_log").insert({
                  user_id: profile.id,
                  email,
                  method: "face",
                  event: "login",
                  success: false,
                  reason: `Face did not match (distance ${dist.toFixed(3)})`,
                  distance: dist,
                  user_agent: userAgent,
                  ip_address: ipAddress,
                });
                res.statusCode = 400;
                res.setHeader("Content-Type", "application/json");
                res.end(
                  JSON.stringify({
                    ok: false,
                    error: `Face did not match (distance ${dist.toFixed(3)})`,
                    distance: dist,
                  })
                );
                return;
              }

              // 5. Match confirmed! Mint session
              const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
                type: "magiclink",
                email,
              });

              if (linkErr || !linkData?.properties?.email_otp) {
                throw new Error(linkErr?.message || "Could not generate session link");
              }

              const otp = linkData.properties.email_otp;
              const { data: verifyData, error: verifyErr } = await supabaseAdmin.auth.verifyOtp({
                type: "magiclink",
                email,
                token: otp,
              });

              if (verifyErr || !verifyData?.session) {
                throw new Error(verifyErr?.message || "Failed to mint session");
              }

              await supabaseAdmin.from("biometric_audit_log").insert({
                user_id: profile.id,
                email,
                method: "face",
                event: "login",
                success: true,
                distance: dist,
                user_agent: userAgent,
                ip_address: ipAddress,
              });

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, session: verifyData.session, distance: dist }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: err?.message || "Internal server error" }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}
