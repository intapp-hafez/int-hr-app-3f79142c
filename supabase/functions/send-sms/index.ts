// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SECTIGO_INTERMEDIATE_CERT = `-----BEGIN CERTIFICATE-----
MIIGTDCCBDSgAwIBAgIQOXpmzCdWNi4NqofKbqvjsTANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgRFYgUjM2MIIBojANBgkqhkiG9w0B
AQEFAAOCAY8AMIIBigKCAYEAljZf2HIz7+SPUPQCQObZYcrxLTHYdf1ZtMRe7Yeq
RPSwygz16qJ9cAWtWNTcuICc++p8Dct7zNGxCpqmEtqifO7NvuB5dEVexXn9RFFH
12Hm+NtPRQgXIFjx6MSJcNWuVO3XGE57L1mHlcQYj+g4hny90aFh2SCZCDEVkAja
EMMfYPKuCjHuuF+bzHFb/9gV8P9+ekcHENF2nR1efGWSKwnfG5RawlkaQDpRtZTm
M64TIsv/r7cyFO4nSjs1jLdXYdz5q3a4L0NoabZfbdxVb+CUEHfB0bpulZQtH1Rv
38e/lIdP7OTTIlZh6OYL6NhxP8So0/sht/4J9mqIGxRFc0/pC8suja+wcIUna0HB
pXKfXTKpzgis+zmXDL06ASJf5E4A2/m+Hp6b84sfPAwQ766rI65mh50S0Di9E3Pn
2WcaJc+PILsBmYpgtmgWTR9eV9otfKRUBfzHUHcVgarub/XluEpRlTtZudU5xbFN
xx/DgMrXLUAPaI60fZ6wA+PTAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk
lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQUaMASFhgOr872h6YyV6NGUV3LBycw
DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI
KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgEw
VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv
UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH
AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp
Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF
BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA
YtOC9Fy+TqECFw40IospI92kLGgoSZGPOSQXMBqmsGWZUQ7rux7cj1du6d9rD6C8
ze1B2eQjkrGkIL/OF1s7vSmgYVafsRoZd/IHUrkoQvX8FZwUsmPu7amgBfaY3g+d
q1x0jNGKb6I6Bzdl6LgMD9qxp+3i7GQOnd9J8LFSietY6Z4jUBzVoOoz8iAU84OF
h2HhAuiPw1ai0VnY38RTI+8kepGWVfGxfBWzwH9uIjeooIeaosVFvE8cmYUB4TSH
5dUyD0jHct2+8ceKEtIoFU/FfHq/mDaVnvcDCZXtIgitdMFQdMZaVehmObyhRdDD
4NQCs0gaI9AAgFj4L9QtkARzhQLNyRf87Kln+YU0lgCGr9HLg3rGO8q+Y4ppLsOd
unQZ6ZxPNGIfOApbPVf5hCe58EZwiWdHIMn9lPP6+F404y8NNugbQixBber+x536
WrZhFZLjEkhp7fFXf9r32rNPfb74X/U90Bdy4lzp3+X1ukh1BuMxA/EEhDoTOS3l
7ABvc7BYSQubQ2490OcdkIzUh3ZwDrakMVrbaTxUM2p24N6dB+ns2zptWCva6jzW
r8IWKIMxzxLPv5Kt3ePKcUdvkBU/smqujSczTzzSjIoR5QqQA6lN1ZRSnuHIWCvh
JEltkYnTAH41QJ6SAWO66GrrUESwN/cgZzL4JLEqz1Y=
-----END CERTIFICATE-----`;

async function fetchEpush(url: URL): Promise<{ status: number; body: string }> {
  let conn: Deno.TlsConn;
  try {
    conn = await Deno.connectTls({
      hostname: "api.epusheg.com",
      port: 443,
      caCerts: [SECTIGO_INTERMEDIATE_CERT],
    });
  } catch (_e) {
    conn = await Deno.connectTls({
      hostname: "api.epusheg.com",
      port: 443,
    });
  }

  const req = `GET ${url.pathname}${url.search} HTTP/1.1\r\nHost: api.epusheg.com\r\nUser-Agent: INT-HR-SMS-Client/1.0\r\nAccept: application/json\r\nConnection: close\r\n\r\n`;
  const writer = conn.writable.getWriter();
  await writer.write(new TextEncoder().encode(req));
  writer.releaseLock();

  const reader = conn.readable.getReader();
  let raw = "";
  const dec = new TextDecoder();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    raw += dec.decode(value, { stream: true });
  }
  try { conn.close(); } catch {}

  const bodyIdx = raw.indexOf("\r\n\r\n");
  const headers = bodyIdx >= 0 ? raw.slice(0, bodyIdx) : "";
  let body = bodyIdx >= 0 ? raw.slice(bodyIdx + 4) : raw;

  // Handle chunked transfer encoding if present
  if (headers.toLowerCase().includes("transfer-encoding: chunked")) {
    let clean = "";
    let pos = 0;
    while (pos < body.length) {
      const lineEnd = body.indexOf("\r\n", pos);
      if (lineEnd === -1) break;
      const sizeStr = body.slice(pos, lineEnd).trim().split(";")[0];
      const chunkSize = parseInt(sizeStr, 16);
      if (isNaN(chunkSize) || chunkSize === 0) break;
      pos = lineEnd + 2;
      clean += body.slice(pos, pos + chunkSize);
      pos += chunkSize + 2;
    }
    if (clean) body = clean;
  }

  const statusMatch = headers.match(/HTTP\/1\.[01]\s+(\d+)/);
  const status = statusMatch ? parseInt(statusMatch[1], 10) : 200;
  return { status, body };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { ok: false, error: "Missing auth token" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) return json(401, { ok: false, error: "Invalid session" });

    const uid = userData.user.id;
    const [isAdmin, isHr] = await Promise.all([
      supabase.rpc("has_role", { _user_id: uid, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: uid, _role: "hr" }),
    ]);
    if (!isAdmin.data && !isHr.data) {
      return json(403, { ok: false, error: "Forbidden" });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json(400, { ok: false, error: "Invalid body" });

    const auth = body.auth;
    const msg = body.msg;
    if (!auth?.username || !auth?.password || !auth?.apiKey || !auth?.sender) {
      return json(400, { ok: false, error: "Missing SMS credentials" });
    }
    if (!msg?.mobile || !msg?.message) {
      return json(400, { ok: false, error: "Missing mobile or message" });
    }

    const url = new URL("https://api.epusheg.com/api/v2/send_bulk");
    url.searchParams.set("username", auth.username);
    url.searchParams.set("password", auth.password);
    url.searchParams.set("api_key", auth.apiKey);
    url.searchParams.set("from", auth.sender);
    url.searchParams.set("to", msg.mobile);
    url.searchParams.set("message", msg.message);

    const { status: httpStatus, body: responseText } = await fetchEpush(url);

    let parsed: any = null;
    try { parsed = JSON.parse(responseText.trim()); } catch {}

    if (httpStatus >= 400) {
      return json(200, { ok: false, error: `HTTP ${httpStatus}: ${responseText.slice(0, 200)}`, raw: parsed ?? responseText });
    }

    const status = String(parsed?.status ?? parsed?.code ?? "").toLowerCase();
    const hasMsgId = Boolean(parsed?.new_msg_id || parsed?.message_id || parsed?.SMSID || parsed?.id);
    const ok = hasMsgId || status === "success" || status === "ok" || status === "1" || parsed?.success === true;
    const smsId = parsed?.new_msg_id ?? parsed?.message_id ?? parsed?.SMSID ?? parsed?.id ?? null;
    const cost = parsed?.transaction_price ?? parsed?.cost ?? parsed?.Cost ?? null;
    const providerCode = parsed?.code ?? parsed?.status ?? (hasMsgId ? "200" : null);

    return json(200, {
      ok,
      code: providerCode ? String(providerCode) : undefined,
      smsId: smsId ? String(smsId) : undefined,
      cost: cost != null ? String(cost) : undefined,
      raw: parsed ?? responseText,
      error: ok ? undefined : (parsed?.message ?? parsed?.error ?? `Provider error: ${responseText.slice(0, 150)}`),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return json(500, { ok: false, error: message });
  }
});
