import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type HealthCheckStatus = "pass" | "fail" | "warn";

export type HealthCheckItem = {
  name: string;
  category: "database" | "face" | "fingerprint";
  status: HealthCheckStatus;
  message: string;
  latencyMs?: number;
  details?: Record<string, any>;
};

export type BiometricHealthReport = {
  overallStatus: "pass" | "warn" | "fail";
  checkedAt: string;
  checks: HealthCheckItem[];
  stats: {
    enrolledFaces: number;
    registeredFingerprints: number;
    totalAuditLogs: number;
    activeChallenges: number;
  };
};

export const getBiometricHealthStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BiometricHealthReport> => {
    const { supabase, userId } = context;

    // Verify admin / hr authorization
    const { data: hasRole } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const { data: isHr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "hr",
    });
    if (!hasRole && !isHr) throw new Error("Forbidden: Admin or HR access required");

    const checks: HealthCheckItem[] = [];

    // ── 1. Database Connectivity ──────────────────────────────
    const dbStart = performance.now();
    let dbStatus: HealthCheckStatus = "pass";
    let dbMsg = "Database connected and responsive";
    let dbLatency = 0;
    try {
      const { error: pingErr } = await supabase
        .from("biometric_audit_log")
        .select("id", { count: "exact", head: true });
      dbLatency = Math.round(performance.now() - dbStart);
      if (pingErr) {
        dbStatus = "fail";
        dbMsg = `Database ping failed: ${pingErr.message}`;
      } else if (dbLatency > 1200) {
        dbStatus = "warn";
        dbMsg = `Database response is slow (${dbLatency}ms)`;
      } else {
        dbMsg = `Database ping successful (${dbLatency}ms)`;
      }
    } catch (e: any) {
      dbStatus = "fail";
      dbMsg = `Database connection exception: ${e?.message ?? "unknown error"}`;
      dbLatency = Math.round(performance.now() - dbStart);
    }

    checks.push({
      name: "Database Connectivity & Latency",
      category: "database",
      status: dbStatus,
      message: dbMsg,
      latencyMs: dbLatency,
    });

    // ── 2. Face Persistence Check ─────────────────────────────
    const faceStart = performance.now();
    let faceStatus: HealthCheckStatus = "pass";
    let faceMsg = "Face storage and vector integrity verified";
    let enrolledFacesCount = 0;
    let faceDetails: Record<string, any> = {};

    try {
      const [{ count: totalFaces, error: countErr }, { data: sampleRow, error: sampleErr }] = await Promise.all([
        supabase.from("face_descriptors").select("*", { count: "exact", head: true }),
        supabase.from("face_descriptors").select("user_id, descriptor, enrolled_at").limit(1).maybeSingle(),
      ]);

      if (countErr) {
        faceStatus = "fail";
        faceMsg = `Face table unreachable: ${countErr.message}`;
      } else {
        enrolledFacesCount = totalFaces ?? 0;
        let vectorValid = true;
        let vectorLength = 0;

        if (sampleRow?.descriptor) {
          const desc = sampleRow.descriptor as unknown as any[];
          vectorLength = Array.isArray(desc) ? desc.length : 0;
          vectorValid = vectorLength === 128 && desc.every((n) => typeof n === "number" && !isNaN(n));
        }

        faceDetails = {
          totalEnrolled: enrolledFacesCount,
          sampleVectorLength: vectorLength || (enrolledFacesCount > 0 ? "invalid" : "none"),
          vectorIntegrity: vectorValid ? "128-float euclidean vector" : "irregular format",
        };

        if (!vectorValid && sampleRow) {
          faceStatus = "warn";
          faceMsg = `Stored descriptor format mismatch (expected 128 elements, got ${vectorLength})`;
        } else {
          faceMsg = `Face persistence operational (${enrolledFacesCount} enrolled employee profiles)`;
        }
      }
    } catch (e: any) {
      faceStatus = "fail";
      faceMsg = `Face persistence check error: ${e?.message ?? "unknown error"}`;
    }

    checks.push({
      name: "Face Descriptor Persistence",
      category: "face",
      status: faceStatus,
      message: faceMsg,
      latencyMs: Math.round(performance.now() - faceStart),
      details: faceDetails,
    });

    // ── 3. Fingerprint (WebAuthn) Registration ────────────────
    const fpStart = performance.now();
    let fpStatus: HealthCheckStatus = "pass";
    let fpMsg = "WebAuthn credential storage operational";
    let credCount = 0;
    let challengeCount = 0;
    let fpDetails: Record<string, any> = {};

    try {
      const [
        { count: totalCreds, error: credErr },
        { count: totalChallenges, error: chalErr },
      ] = await Promise.all([
        supabase.from("webauthn_credentials").select("*", { count: "exact", head: true }),
        supabase.from("webauthn_challenges").select("*", { count: "exact", head: true }),
      ]);

      if (credErr || chalErr) {
        fpStatus = "fail";
        fpMsg = `WebAuthn tables unreachable: ${credErr?.message || chalErr?.message}`;
      } else {
        credCount = totalCreds ?? 0;
        challengeCount = totalChallenges ?? 0;

        // Clean up expired challenges
        const nowIso = new Date().toISOString();
        const { error: cleanErr } = await supabase
          .from("webauthn_challenges")
          .delete()
          .lt("expires_at", nowIso);

        fpDetails = {
          registeredCredentials: credCount,
          activeChallenges: challengeCount,
          challengeCleanup: cleanErr ? `cleanup failed: ${cleanErr.message}` : "active & clean",
          authProtocol: "FIDO2 / WebAuthn Level 3",
        };
        fpMsg = `WebAuthn registration pipeline operational (${credCount} enrolled credentials)`;
      }
    } catch (e: any) {
      fpStatus = "fail";
      fpMsg = `WebAuthn check error: ${e?.message ?? "unknown error"}`;
    }

    checks.push({
      name: "Fingerprint & WebAuthn Registration",
      category: "fingerprint",
      status: fpStatus,
      message: fpMsg,
      latencyMs: Math.round(performance.now() - fpStart),
      details: fpDetails,
    });

    // ── 4. Biometric Audit Log Table Check ────────────────────
    let totalLogs = 0;
    try {
      const { count } = await supabase
        .from("biometric_audit_log")
        .select("*", { count: "exact", head: true });
      totalLogs = count ?? 0;
    } catch {}

    const overallStatus: "pass" | "warn" | "fail" = checks.some((c) => c.status === "fail")
      ? "fail"
      : checks.some((c) => c.status === "warn")
        ? "warn"
        : "pass";

    return {
      overallStatus,
      checkedAt: new Date().toISOString(),
      checks,
      stats: {
        enrolledFaces: enrolledFacesCount,
        registeredFingerprints: credCount,
        totalAuditLogs: totalLogs,
        activeChallenges: challengeCount,
      },
    };
  });

// ── Query and filter biometric audit logs ───────────────────
const FilterSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(200).default(25),
  method: z.enum(["all", "face", "fingerprint"]).optional().default("all"),
  event: z.enum(["all", "enroll", "unenroll", "verify", "login", "check_in", "check_out"]).optional().default("all"),
  status: z.enum(["all", "success", "failed"]).optional().default("all"),
  query: z.string().optional(),
  search: z.string().optional(),
  fromDate: z.string().optional(),
  from: z.string().optional(),
  toDate: z.string().optional(),
  to: z.string().optional(),
});

export type BiometricAuditFilterInput = z.infer<typeof FilterSchema>;

export type BiometricAuditRow = {
  id: string;
  userId: string | null;
  employeeName: string;
  employeeEmail: string;
  method: "face" | "fingerprint";
  event: "enroll" | "unenroll" | "verify" | "login" | "check_in" | "check_out";
  success: boolean;
  reason: string | null;
  distance: number | null;
  deviceLabel: string | null;
  deviceId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
};

export type BiometricAuditResult = {
  items: BiometricAuditRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  stats: {
    total: number;
    success: number;
    failed: number;
    faceCount: number;
    fingerprintCount: number;
    successRate: number;
  };
};

export const getBiometricAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => FilterSchema.parse(i ?? {}))
  .handler(async ({ data, context }): Promise<BiometricAuditResult> => {
    const { supabase, userId } = context;

    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const { data: isHr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "hr",
    });
    if (!isAdmin && !isHr) throw new Error("Forbidden: Admin or HR access required");

    // Build query
    let q = supabase
      .from("biometric_audit_log")
      .select(
        "id, user_id, email, method, event, success, reason, distance, device_label, device_id, user_agent, ip_address, created_at, profiles:user_id(full_name, email, avatar_url)",
        { count: "exact" }
      );

    const method = data?.method && data.method !== "all" ? data.method : null;
    const event = data?.event && data.event !== "all" ? data.event : null;
    const status = data?.status && data.status !== "all" ? data.status : null;
    const fromDateStr = data?.fromDate || data?.from || null;
    const toDateStr = data?.toDate || data?.to || null;
    const searchText = (data?.query || data?.search || "").trim();

    if (method) {
      q = q.eq("method", method);
    }
    if (event) {
      q = q.eq("event", event);
    }
    if (status === "success") {
      q = q.eq("success", true);
    } else if (status === "failed") {
      q = q.eq("success", false);
    }
    if (fromDateStr) {
      q = q.gte("created_at", new Date(fromDateStr).toISOString());
    }
    if (toDateStr) {
      const end = new Date(toDateStr);
      end.setHours(23, 59, 59, 999);
      q = q.lte("created_at", end.toISOString());
    }

    const start = (data.page - 1) * data.pageSize;
    const end = start + data.pageSize - 1;

    const { data: rows, count, error } = await q
      .order("created_at", { ascending: false })
      .range(start, end);

    if (error) throw new Error(error.message);

    const total = count ?? 0;
    let items: BiometricAuditRow[] = (rows ?? []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      employeeName: r.profiles?.full_name || r.email?.split("@")[0] || "Unknown",
      employeeEmail: r.email || r.profiles?.email || "—",
      method: r.method,
      event: r.event,
      success: r.success,
      reason: r.reason,
      distance: r.distance != null ? Number(r.distance) : null,
      deviceLabel: r.device_label,
      deviceId: r.device_id,
      userAgent: r.user_agent,
      ipAddress: r.ip_address,
      createdAt: r.created_at,
    }));

    // Client-side text search if provided
    if (searchText) {
      const term = searchText.toLowerCase();
      items = items.filter(
        (i) =>
          i.employeeName.toLowerCase().includes(term) ||
          i.employeeEmail.toLowerCase().includes(term) ||
          (i.deviceLabel && i.deviceLabel.toLowerCase().includes(term)) ||
          (i.reason && i.reason.toLowerCase().includes(term)) ||
          (i.ipAddress && i.ipAddress.toLowerCase().includes(term))
      );
    }

    // Quick stats across all logs (approximate from latest sample or counts)
    const { data: statRows } = await supabase
      .from("biometric_audit_log")
      .select("success, method")
      .order("created_at", { ascending: false })
      .limit(1000);

    const allStats = statRows ?? [];
    const succCount = allStats.filter((x) => x.success).length;
    const failCount = allStats.filter((x) => !x.success).length;
    const faceCount = allStats.filter((x) => x.method === "face").length;
    const fpCount = allStats.filter((x) => x.method === "fingerprint").length;
    const rate = allStats.length > 0 ? Math.round((succCount / allStats.length) * 100) : 100;

    return {
      items,
      total,
      page: data.page,
      pageSize: data.pageSize,
      totalPages: Math.max(1, Math.ceil(total / data.pageSize)),
      stats: {
        total: allStats.length,
        success: succCount,
        failed: failCount,
        faceCount,
        fingerprintCount: fpCount,
        successRate: rate,
      },
    };
  });
