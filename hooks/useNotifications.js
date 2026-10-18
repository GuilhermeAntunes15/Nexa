"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { createClient } from "@/lib/supabase/client";

export default function useNotifications() {
  const supabase = useMemo(() => createClient(), []);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [notificationsResult, countResult] = await Promise.all([
      supabase.rpc("get_my_notifications", { p_limit: 50 }),
      supabase.rpc("get_unread_notification_count"),
    ]);

    if (!notificationsResult.error) {
      setNotifications(notificationsResult.data || []);
    }

    if (!countResult.error) {
      setUnread(Number(countResult.data) || 0);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    let cancelled = false;
    let channel = null;

    async function start() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        setLoading(false);
        return;
      }

      await load();
      if (cancelled) return;

      // A navegação e a página de avisos usam o hook ao mesmo tempo. O sufixo
      // também muda entre remontagens do React enquanto o canal anterior sai.
      const channelId =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      channel = supabase
        .channel(`notifications:${user.id}:${channelId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            void load();
          }
        );

      channel.subscribe();
    }

    void start();

    return () => {
      cancelled = true;

      if (channel) {
        void supabase.removeChannel(channel);
        channel = null;
      }
    };
  }, [load, supabase]);

  async function markRead(notificationId) {
    await supabase.rpc("mark_notification_read", {
      target_notification: notificationId,
    });
    await load();
  }

  async function markAllRead() {
    await supabase.rpc("mark_all_notifications_read");
    await load();
  }

  return {
    notifications,
    unread,
    loading,
    reload: load,
    markRead,
    markAllRead,
  };
}
