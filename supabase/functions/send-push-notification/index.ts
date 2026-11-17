// @ts-nocheck
// Real-time Android Push Notification Dispatcher (FCM HTTP v1)
// Supports both Supabase Database Webhooks and direct authenticated admin/service calls.
// Required Secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64Url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(clean);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getGoogleAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(signingInput))
  );
  const jwt = `${signingInput}.${base64Url(sig)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(`OAuth token exchange failed: ${JSON.stringify(data)}`);
  }
  return data.access_token;
}

type PushDispatch = {
  userIds: string[];
  title: string;
  body: string;
  channelId: string;
  route: string;
  data?: Record<string, string>;
};

async function resolveWebhookEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  payload: Record<string, any>
): Promise<PushDispatch | null> {
  const table = String(payload.table || "");
  const type = String(payload.type || "");
  const record = payload.record || {};
  const oldRecord = payload.old_record || {};

  if (table === "tasks" && (type === "INSERT" || type === "UPDATE")) {
    const assignees: string[] = Array.isArray(record.assignees) ? record.assignees : [];
    if (!assignees.length) return null;
    return {
      userIds: assignees,
      title: type === "INSERT" ? "New task assigned" : "Task updated",
      body: String(record.title || "Check your assigned tasks"),
      channelId: "tasks",
      route: `/tasks/${record.id}`,
    };
  }

  if (table === "task_activity" && type === "INSERT" && record.task_id) {
    const { data: task } = await supabaseAdmin
      .from("tasks")
      .select("created_by, title")
      .eq("id", record.task_id)
      .maybeSingle();
    if (!task?.created_by || task.created_by === record.employee_id) return null;
    const actionLabel =
      record.kind === "complete_task" ? "Task completed" : record.kind === "start_task" ? "Task started" : "Task update";
    return {
      userIds: [task.created_by],
      title: actionLabel,
      body: String(task.title || record.task_name || "Employee updated a task"),
      channelId: "tasks",
      route: `/tasks/${record.task_id}`,
    };
  }

  if ((table === "leaves" || table === "employee_permissions") && type === "INSERT") {
    const { data: emp } = await supabaseAdmin
      .from("profiles")
      .select("full_name, manager_id")
      .eq("id", record.employee_id)
      .maybeSingle();
    if (!emp?.manager_id) return null;
    const kind = table === "leaves" ? "leave request" : "permission request";
    return {
      userIds: [emp.manager_id],
      title: `New ${kind}`,
      body: `${emp.full_name || "An employee"} submitted a ${kind}`,
      channelId: "requests",
      route: `/requests/${record.id}`,
    };
  }

  if (
    (table === "leaves" || table === "employee_permissions") &&
    type === "UPDATE" &&
    record.status !== oldRecord.status &&
    (record.status === "approved" || record.status === "rejected")
  ) {
    const approved = record.status === "approved";
    const kind = table === "leaves" ? "Leave request" : "Permission request";
    return {
      userIds: [record.employee_id],
      title: approved ? `${kind} approved` : `${kind} rejected`,
      body: `Status updated to ${record.status}`,
      channelId: "requests",
      route: `/requests/${record.id}`,
    };
  }

  if (table === "chat_messages" && type === "INSERT" && record.channel_id) {
    const { data: members } = await supabaseAdmin
      .from("chat_channel_members")
      .select("user_id")
      .eq("channel_id", record.channel_id);
    const recipients = (members || [])
      .map((m: { user_id: string }) => m.user_id)
      .filter((id: string) => id && id !== record.sender_id);
    if (!recipients.length) return null;
    return {
      userIds: recipients,
      title: "New message",
      body: "You have a new message in HR Portal",
      channelId: "messages",
      route: "/profile/messages",
    };
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID");
    const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
    const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY");

    if (!projectId || !clientEmail || !privateKey) {
      return json(500, { ok: false, error: "Missing Firebase service account secrets." });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();

    let dispatch: PushDispatch | null = null;
    if (body.table && body.type) {
      const webhookSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
      if (webhookSecret && req.headers.get("x-webhook-secret") !== webhookSecret) {
        return json(401, { ok: false, error: "Invalid webhook secret" });
      }
      dispatch = await resolveWebhookEvent(supabaseAdmin, body);
    } else if (Array.isArray(body.user_ids) && body.title && body.body) {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (token !== serviceKey) {
        const { data: caller } = await supabaseAdmin.auth.getUser(token);
        if (!caller?.user) return json(401, { ok: false, error: "Unauthorized" });
        const { data: roleRows } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", caller.user.id);
        const allowed = (roleRows || []).some((r: { role: string }) =>
          ["admin", "hr", "manager"].includes(r.role)
        );
        if (!allowed) return json(403, { ok: false, error: "Forbidden" });
      }
      dispatch = {
        userIds: body.user_ids,
        title: String(body.title),
        body: String(body.body),
        channelId: String(body.channel_id || "general"),
        route: String(body.route || "/dashboard"),
        data: body.data || {},
      };
    }

    if (!dispatch || !dispatch.userIds.length) {
      return json(200, { ok: true, skipped: true, reason: "No target recipients" });
    }

    const uniqueUsers = [...new Set(dispatch.userIds)];
    const { data: tokens, error: tokErr } = await supabaseAdmin
      .from("device_push_tokens")
      .select("id, user_id, fcm_token")
      .in("user_id", uniqueUsers);

    if (tokErr) return json(500, { ok: false, error: tokErr.message });
    if (!tokens || tokens.length === 0) {
      return json(200, { ok: true, sent: 0, reason: "No registered device tokens" });
    }

    const accessToken = await getGoogleAccessToken(clientEmail, privateKey);
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    let sent = 0;
    let failed = 0;
    const staleTokenIds: string[] = [];

    for (const row of tokens) {
      const res = await fetch(fcmEndpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: row.fcm_token,
            notification: {
              title: dispatch.title,
              body: dispatch.body,
            },
            data: {
              route: dispatch.route,
              channel_id: dispatch.channelId,
              ...(dispatch.data || {}),
            },
            android: {
              priority: "HIGH",
              notification: {
                channel_id: dispatch.channelId,
                sound: "default",
              },
            },
          },
        }),
      });

      const resBody = await res.json().catch(() => ({}));
      const ok = res.ok;
      if (ok) sent++;
      else {
        failed++;
        const errStatus = resBody?.error?.details?.[0]?.errorCode || resBody?.error?.status;
        if (res.status === 404 || errStatus === "UNREGISTERED") {
          staleTokenIds.push(row.id);
        }
      }

      await supabaseAdmin.from("notif_deliveries").insert({
        user_id: row.user_id,
        recipient: row.fcm_token.slice(0, 24) + "...",
        channel: "push",
        status: ok ? "sent" : "failed",
        subject: dispatch.title,
        payload: { body: dispatch.body, route: dispatch.route, channelId: dispatch.channelId },
        error: ok ? null : JSON.stringify(resBody).slice(0, 500),
      });
    }

    if (staleTokenIds.length > 0) {
      await supabaseAdmin.from("device_push_tokens").delete().in("id", staleTokenIds);
    }

    return json(200, { ok: true, sent, failed, cleaned: staleTokenIds.length });
  } catch (err) {
    return json(500, { ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

