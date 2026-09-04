import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ChatChannelItem = {
  id: string;
  type: "direct" | "department" | "broadcast";
  name: string;
  department_id?: string | null;
  department_name?: string | null;
  last_message_at: string;
  unread_count: number;
  last_message?: {
    id: string;
    content: string;
    sender_name: string;
    created_at: string;
  } | null;
  recipient?: {
    id: string;
    name: string;
    email: string;
    department?: string | null;
    avatar_url?: string | null;
  } | null;
  participant_count?: number;
};

export type ChatMessageItem = {
  id: string;
  channel_id: string;
  sender_id: string;
  sender_name: string;
  sender_role?: string;
  content: string;
  attachments?: any[];
  is_system: boolean;
  created_at: string;
  is_mine: boolean;
};

/**
 * List channels accessible to the current user with unread counts and last message previews
 */
export const listMyChannels = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChatChannelItem[]> => {
    const { supabase, userId } = context;
    const sb = supabase as any;

    // 1. Get channel IDs the user participates in
    const { data: partRows, error: pErr } = await sb
      .from("chat_participants")
      .select("channel_id, last_read_at")
      .eq("user_id", userId);

    if (pErr) {
      console.warn("[chat.functions] Failed to query chat_participants:", pErr.message);
      return [];
    }

    const myPartMap = new Map<string, string>();
    (partRows ?? []).forEach((p: any) => myPartMap.set(p.channel_id, p.last_read_at));

    const channelIds = Array.from(myPartMap.keys());

    // 2. Fetch channel metadata (including broadcast channels)
    let query = sb.from("chat_channels").select("*");
    if (channelIds.length > 0) {
      query = query.or(`id.in.(${channelIds.join(",")}),type.eq.broadcast`);
    } else {
      query = query.eq("type", "broadcast");
    }

    const { data: channels, error: cErr } = await query.order("last_message_at", { ascending: false });
    if (cErr) {
      console.warn("[chat.functions] Failed to query chat_channels:", cErr.message);
      return [];
    }
    if (!channels || channels.length === 0) return [];

    const allChannelIds = channels.map((c: any) => c.id);

    // 3. Fetch all participants for these channels to resolve direct chat recipients & counts
    const { data: allParticipants } = await sb
      .from("chat_participants")
      .select("channel_id, user_id")
      .in("channel_id", allChannelIds);

    const participantCountMap = new Map<string, number>();
    const otherUserIds: string[] = [];
    const directChannelToOtherUser = new Map<string, string>();

    (allParticipants ?? []).forEach((p: any) => {
      participantCountMap.set(p.channel_id, (participantCountMap.get(p.channel_id) ?? 0) + 1);
      if (p.user_id !== userId) {
        otherUserIds.push(p.user_id);
        directChannelToOtherUser.set(p.channel_id, p.user_id);
      }
    });

    // 4. Fetch profiles for other participants
    const profileMap = new Map<string, any>();
    if (otherUserIds.length > 0) {
      const [{ data: profiles }, { data: depts }] = await Promise.all([
        sb
          .from("profiles")
          .select("id, full_name, email, department_id, avatar_url")
          .in("id", Array.from(new Set(otherUserIds))),
        sb.from("departments").select("id, name_en"),
      ]);
      const dMap = new Map((depts ?? []).map((d: any) => [d.id, d.name_en]));
      (profiles ?? []).forEach((pr: any) => {
        profileMap.set(pr.id, {
          ...pr,
          department: pr.department_id ? dMap.get(pr.department_id) : undefined,
        });
      });
    }

    // 5. Fetch last message and unread count for each channel
    const { data: recentMessages } = await sb
      .from("chat_messages")
      .select("id, channel_id, sender_id, content, created_at")
      .in("channel_id", allChannelIds)
      .order("created_at", { ascending: false });

    // Group messages by channel
    const lastMessageMap = new Map<string, any>();
    const unreadCountMap = new Map<string, number>();

    (recentMessages ?? []).forEach((m: any) => {
      if (!lastMessageMap.has(m.channel_id)) {
        lastMessageMap.set(m.channel_id, m);
      }
      const lastRead = myPartMap.get(m.channel_id);
      const isUnread = (!lastRead || new Date(m.created_at) > new Date(lastRead)) && m.sender_id !== userId;
      if (isUnread) {
        unreadCountMap.set(m.channel_id, (unreadCountMap.get(m.channel_id) ?? 0) + 1);
      }
    });

    // 6. Assemble result items
    return channels.map((c: any): ChatChannelItem => {
      const otherUserId = directChannelToOtherUser.get(c.id);
      const otherProfile = otherUserId ? profileMap.get(otherUserId) : null;
      const lastMsg = lastMessageMap.get(c.id);
      const lastMsgSender = lastMsg ? profileMap.get(lastMsg.sender_id)?.full_name ?? (lastMsg.sender_id === userId ? "You" : "User") : "";

      let channelName = c.name;
      if (c.type === "direct") {
        channelName = otherProfile?.full_name || otherProfile?.email || "Direct Message";
      } else if (c.type === "department") {
        channelName = c.department_name ? `${c.department_name} Department` : c.name || "Department";
      } else if (c.type === "broadcast") {
        channelName = c.name || "Company Announcements";
      }

      return {
        id: c.id,
        type: c.type,
        name: channelName,
        department_id: c.department_id,
        department_name: c.department_name,
        last_message_at: c.last_message_at,
        unread_count: unreadCountMap.get(c.id) ?? 0,
        participant_count: participantCountMap.get(c.id) ?? (c.type === "broadcast" ? undefined : 2),
        recipient: otherProfile
          ? {
              id: otherProfile.id,
              name: otherProfile.full_name || otherProfile.email,
              email: otherProfile.email,
              department: otherProfile.department,
              avatar_url: otherProfile.avatar_url,
            }
          : null,
        last_message: lastMsg
          ? {
              id: lastMsg.id,
              content: lastMsg.content,
              sender_name: lastMsgSender,
              created_at: lastMsg.created_at,
            }
          : null,
      };
    });
  });

/**
 * Fetch messages in a channel and mark channel as read
 */
export const getChannelMessages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ channelId: z.string().uuid(), limit: z.number().min(1).max(200).default(100) }).parse(i))
  .handler(async ({ data, context }): Promise<ChatMessageItem[]> => {
    const { supabase, userId } = context;
    const sb = supabase as any;

    // 1. Fetch channel messages
    const { data: messages, error } = await sb
      .from("chat_messages")
      .select("id, channel_id, sender_id, content, attachments, is_system, created_at")
      .eq("channel_id", data.channelId)
      .order("created_at", { ascending: true })
      .limit(data.limit);

    if (error) throw new Error(error.message);
    if (!messages || messages.length === 0) return [];

    // 2. Fetch sender names & roles
    const senderIds = Array.from(new Set(messages.map((m: any) => m.sender_id)));
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      sb.from("profiles").select("id, full_name, email, avatar_url").in("id", senderIds),
      sb.from("user_roles").select("user_id, role").in("user_id", senderIds),
    ]);

    const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]));
    const roleMap = new Map<string, string>((roles ?? []).map((r: any) => [r.user_id, r.role]));

    // 3. Mark channel as read for current user
    await sb
      .from("chat_participants")
      .upsert({ channel_id: data.channelId, user_id: userId, last_read_at: new Date().toISOString() }, { onConflict: "channel_id,user_id" });

    return messages.map((m: any): ChatMessageItem => {
      const p = profileMap.get(m.sender_id);
      const role = roleMap.get(m.sender_id);
      return {
        id: m.id,
        channel_id: m.channel_id,
        sender_id: m.sender_id,
        sender_name: p?.full_name || p?.email || "User",
        sender_role: role,
        content: m.content,
        attachments: m.attachments,
        is_system: m.is_system,
        created_at: m.created_at,
        is_mine: m.sender_id === userId,
      };
    });
  });

/**
 * Send a message to an existing channel
 */
export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ channelId: z.string().uuid(), content: z.string().min(1).max(5000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sb = supabase as any;
    const now = new Date().toISOString();

    // 1. Insert message
    const { data: msg, error: mErr } = await sb
      .from("chat_messages")
      .insert({
        channel_id: data.channelId,
        sender_id: userId,
        content: data.content.trim(),
        created_at: now,
      })
      .select()
      .single();

    if (mErr) throw new Error(mErr.message);

    // 2. Update channel last_message_at
    await sb
      .from("chat_channels")
      .update({ last_message_at: now, updated_at: now })
      .eq("id", data.channelId);

    // 3. Update sender last_read_at
    await sb
      .from("chat_participants")
      .upsert({ channel_id: data.channelId, user_id: userId, last_read_at: now }, { onConflict: "channel_id,user_id" });

    return { ok: true, message: msg };
  });

/**
 * Send a new Direct, Department Group, or Broadcast message
 */
export const sendGroupOrDirectMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i) =>
      z
        .object({
          targetType: z.enum(["direct", "department", "broadcast"]),
          targetId: z.string().optional(), // Employee ID or Department ID
          content: z.string().min(1).max(5000),
        })
        .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const sb = supabase as any;
    const now = new Date().toISOString();

    let targetChannelId: string | null = null;

    if (data.targetType === "direct") {
      if (!data.targetId) throw new Error("Target employee ID is required for direct messaging");

      // Find if direct channel already exists between these 2 users
      const { data: myChannels } = await sb
        .from("chat_participants")
        .select("channel_id")
        .eq("user_id", userId);

      const myChanIds = (myChannels ?? []).map((c: any) => c.channel_id);

      if (myChanIds.length > 0) {
        const { data: matchingChan } = await sb
          .from("chat_participants")
          .select("channel_id, chat_channels!inner(type)")
          .eq("user_id", data.targetId)
          .in("channel_id", myChanIds)
          .eq("chat_channels.type", "direct")
          .limit(1)
          .maybeSingle();

        if (matchingChan) {
          targetChannelId = (matchingChan as any).channel_id;
        }
      }

      // If no direct channel exists, create one
      if (!targetChannelId) {
        const { data: newChan, error: cErr } = await sb
          .from("chat_channels")
          .insert({
            type: "direct",
            created_by: userId,
            last_message_at: now,
          })
          .select("id")
          .single();

        if (cErr) throw new Error(cErr.message);
        targetChannelId = (newChan as any).id;

        // Enroll both participants
        await sb.from("chat_participants").insert([
          { channel_id: targetChannelId, user_id: userId, last_read_at: now },
          { channel_id: targetChannelId, user_id: data.targetId, last_read_at: new Date(0).toISOString() },
        ]);
      }
    } else if (data.targetType === "department") {
      if (!data.targetId) throw new Error("Department ID or name is required");

      // Resolve department info
      let deptId = data.targetId;
      let deptName = data.targetId;

      const inputIsUuid = Boolean(data.targetId.match(/^[0-9a-fA-F-]{36}$/));
      const { data: deptRow } = await sb
        .from("departments")
        .select("id, name_en, name_ar")
        .or(`id.eq.${inputIsUuid ? data.targetId : "00000000-0000-0000-0000-000000000000"},name_en.ilike.%${data.targetId}%`)
        .maybeSingle();

      if (deptRow) {
        deptId = deptRow.id;
        deptName = deptRow.name_en;
      }

      // Check if department channel already exists
      const deptIdIsUuid = /^[0-9a-fA-F-]{36}$/.test(deptId);
      let chanQuery = sb.from("chat_channels").select("id").eq("type", "department");
      if (deptIdIsUuid) {
        chanQuery = chanQuery.eq("department_id", deptId);
      } else {
        chanQuery = chanQuery.ilike("department_name", `%${deptName}%`);
      }
      const { data: existingChan } = await chanQuery.maybeSingle();

      if (existingChan) {
        targetChannelId = (existingChan as any).id;
      } else {
        const { data: newChan, error: cErr } = await sb
          .from("chat_channels")
          .insert({
            type: "department",
            name: `${deptName} Department`,
            department_id: deptIdIsUuid ? deptId : null,
            department_name: deptName,
            created_by: userId,
            last_message_at: now,
          })
          .select("id")
          .single();

        if (cErr) throw new Error(cErr.message);
        targetChannelId = (newChan as any).id;
      }

      // Fetch all employees belonging to this department
      let deptEmployees: any[] = [];
      if (deptIdIsUuid) {
        const { data: emps } = await sb
          .from("profiles")
          .select("id")
          .eq("department_id", deptId);
        deptEmployees = emps ?? [];
      }

      const participantsToEnroll = new Set<string>();
      participantsToEnroll.add(userId);
      (deptEmployees ?? []).forEach((e: any) => participantsToEnroll.add(e.id));

      const participantRows = Array.from(participantsToEnroll).map((uid) => ({
        channel_id: targetChannelId,
        user_id: uid,
        last_read_at: uid === userId ? now : new Date(0).toISOString(),
      }));

      if (participantRows.length > 0) {
        await sb
          .from("chat_participants")
          .upsert(participantRows, { onConflict: "channel_id,user_id", ignoreDuplicates: true });
      }
    } else if (data.targetType === "broadcast") {
      // Find or create Company Announcements channel
      const { data: existingChan } = await sb
        .from("chat_channels")
        .select("id")
        .eq("type", "broadcast")
        .maybeSingle();

      if (existingChan) {
        targetChannelId = (existingChan as any).id;
      } else {
        const { data: newChan, error: cErr } = await sb
          .from("chat_channels")
          .insert({
            type: "broadcast",
            name: "Company Announcements",
            created_by: userId,
            last_message_at: now,
          })
          .select("id")
          .single();

        if (cErr) throw new Error(cErr.message);
        targetChannelId = (newChan as any).id;
      }
    }

    if (!targetChannelId) throw new Error("Failed to initialize target channel");

    // Insert message
    const { data: msg, error: mErr } = await sb
      .from("chat_messages")
      .insert({
        channel_id: targetChannelId,
        sender_id: userId,
        content: data.content.trim(),
        created_at: now,
      })
      .select()
      .single();

    if (mErr) throw new Error(mErr.message);

    // Update channel timestamp
    await sb
      .from("chat_channels")
      .update({ last_message_at: now, updated_at: now })
      .eq("id", targetChannelId);

    // Update sender last_read_at
    await sb
      .from("chat_participants")
      .upsert({ channel_id: targetChannelId, user_id: userId, last_read_at: now }, { onConflict: "channel_id,user_id" });

    return { ok: true, channelId: targetChannelId, message: msg };
  });

/**
 * List departments and employees available for messaging
 */
export const listChatTargets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const sb = supabase as any;

    const [{ data: depts }, { data: profiles }] = await Promise.all([
      sb.from("departments").select("id, name_en, name_ar").order("name_en"),
      sb
        .from("profiles")
        .select("id, full_name, email, department_id, avatar_url, status")
        .order("full_name"),
    ]);

    const deptMap = new Map<string, { en: string; ar: string }>();
    (depts ?? []).forEach((d: any) => {
      deptMap.set(d.id, { en: d.name_en, ar: d.name_ar });
    });

    // Exclude strictly inactive or terminated employees, keeping all active / unassigned
    const activeProfiles = (profiles ?? []).filter(
      (p: any) => p.status !== "Inactive" && p.status !== "Terminated"
    );

    // Count employees per department
    const deptCounts = new Map<string, number>();
    activeProfiles.forEach((p: any) => {
      if (p.department_id) {
        deptCounts.set(p.department_id, (deptCounts.get(p.department_id) ?? 0) + 1);
      }
    });

    const departments = (depts ?? []).map((d: any) => ({
      id: d.id,
      name: d.name_en,
      name_ar: d.name_ar,
      count: deptCounts.get(d.id) ?? 0,
    }));

    return {
      departments,
      employees: activeProfiles.map((p: any) => ({
        id: p.id,
        name: p.full_name || p.email,
        email: p.email,
        department: p.department_id ? deptMap.get(p.department_id)?.en : undefined,
        avatar_url: p.avatar_url,
      })),
    };
  });

/**
 * Get total unread count for badge indicators
 */
export const getChatUnreadTotal = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ total: number }> => {
    const { supabase, userId } = context;
    const sb = supabase as any;

    const { data: parts } = await sb
      .from("chat_participants")
      .select("channel_id, last_read_at")
      .eq("user_id", userId);

    if (!parts || parts.length === 0) return { total: 0 };

    let unread = 0;
    for (const p of parts) {
      const { count } = await sb
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("channel_id", p.channel_id)
        .neq("sender_id", userId)
        .gt("created_at", p.last_read_at || new Date(0).toISOString());
      unread += count ?? 0;
    }

    return { total: unread };
  });
