"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import Link from "next/link";

import {
  MessageCircle,
  Search,
  ShieldCheck
} from "lucide-react";

import {
  createClient
} from "@/lib/supabase/client";

export default function ConversationsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [conversations, setConversations] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc(
      "get_my_conversations"
    );

    if (!error) {
      setConversations(data || []);
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();

    const messagesChannel = supabase
      .channel("conversation-list-messages")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages"
        },
        load
      )
      .subscribe();

    const callsChannel = supabase
      .channel("conversation-list-calls")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "calls"
        },
        load
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(callsChannel);
    };
  }, [supabase, load]);

  const visible = conversations.filter((conversation) => {
    const text = (conversation.title || "").toLowerCase();
    return text.includes(query.toLowerCase());
  });

  return (
    <main className="conversations-page">
      <header className="conversations-header">
        <div>
          <span className="badge">Nexa</span>
          <h1>Conversas</h1>
        </div>

        <Link
          href="/app/solicitacoes"
          className="requests-shortcut"
        >
          Solicitações
        </Link>
      </header>

      <div className="conversation-search">
        <Search size={18} />
        <input
          placeholder="Buscar conversa..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {loading ? (
        <div className="simple-loading">
          Carregando conversas...
        </div>
      ) : visible.length === 0 ? (
        <section className="conversation-empty nexa-card">
          <MessageCircle size={38} />
          <h2>Suas conversas aparecerão aqui</h2>
          <p>Explore o mapa e faça novas conexões.</p>
          <Link href="/app/mapa" className="btn btn-primary">
            Explorar mapa
          </Link>
        </section>
      ) : (
        <section className="conversation-list">
          {visible.map((conversation) => (
            <Link
              href={`/app/conversas/${conversation.conversation_id}`}
              key={conversation.conversation_id}
              className="conversation-item"
            >
              <div className="conversation-avatar-wrapper">
                {conversation.other_avatar ? (
                  <img
                    src={conversation.other_avatar}
                    alt=""
                    className="conversation-avatar"
                  />
                ) : (
                  <div className="conversation-avatar conversation-avatar-fallback">
                    {conversation.title?.charAt(0)?.toUpperCase()}
                  </div>
                )}

                {conversation.other_presence === "online" && (
                  <span className="presence-dot" />
                )}
              </div>

              <div className="conversation-content">
                <div className="conversation-title-row">
                  <strong>{conversation.title}</strong>
                  {conversation.other_verified && (
                    <ShieldCheck size={14} />
                  )}
                </div>
                <span className="conversation-last-message">
                  {conversation.last_message || "Conversa iniciada"}
                </span>
              </div>

              <div className="conversation-meta">
                {conversation.last_message_at && (
                  <small>{formatTime(conversation.last_message_at)}</small>
                )}

                {Number(conversation.unread_count) > 0 && (
                  <span className="unread-badge">
                    {conversation.unread_count}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </section>
      )}
    </main>
  );
}

function formatTime(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}
