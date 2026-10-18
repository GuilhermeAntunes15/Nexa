"use client";

import {
  useEffect,
  useMemo,
  useState
} from "react";
import { Reply } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function MessageBubble({
  message,
  mine,
  read,
  onReply
}) {
  const supabase = useMemo(() => createClient(), []);
  const [signedUrl, setSignedUrl] = useState("");

  useEffect(() => {
    if (!message.media_path) return;

    async function loadMedia() {
      const { data } = await supabase.storage
        .from("chat-media")
        .createSignedUrl(message.media_path, 3600);
      setSignedUrl(data?.signedUrl || "");
    }

    loadMedia();
  }, [supabase, message.media_path]);

  if (message.deleted_at) {
    return (
      <div className={mine ? "message-row mine" : "message-row"}>
        <div className="message-bubble deleted">Mensagem apagada</div>
      </div>
    );
  }

  return (
    <div className={mine ? "message-row mine" : "message-row"}>
      <div className="message-bubble">
        {message.reply_to && (
          <div className="message-reply-preview">
            <strong>{message.reply_sender_name}</strong>
            <span>{message.reply_content || "Mensagem"}</span>
          </div>
        )}

        {message.message_type === "text" && <p>{message.content}</p>}

        {message.message_type === "image" && signedUrl && (
          <img
            src={signedUrl}
            alt="Imagem enviada na conversa"
            className="chat-image"
          />
        )}

        {message.message_type === "audio" && signedUrl && (
          <audio
            controls
            preload="metadata"
            src={signedUrl}
            className="chat-audio"
          />
        )}

        <div className="message-footer">
          <button type="button" onClick={() => onReply(message)} aria-label="Responder">
            <Reply size={13} />
          </button>
          <span>{formatTime(message.created_at)}</span>
          {mine && (
            <span className="message-read-status">{read ? "✓✓" : "✓"}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTime(date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}
