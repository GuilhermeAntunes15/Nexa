"use client";

import Link from "next/link";
import {
  ArrowLeft,
  MoreVertical,
  Phone,
  ShieldCheck,
  Video
} from "lucide-react";

export default function ChatHeader({
  conversation,
  onAudioCall,
  onVideoCall
}) {
  return (
    <header className="chat-header">
      <Link href="/app/conversas" className="chat-header-button">
        <ArrowLeft size={21} />
      </Link>

      <Link
        href={
          conversation.other_user_id
            ? `/app/perfil/${conversation.other_user_id}`
            : "#"
        }
        className="chat-user"
      >
        {conversation.other_avatar ? (
          <img src={conversation.other_avatar} alt="" />
        ) : (
          <div className="chat-user-fallback">
            {conversation.title?.charAt(0)?.toUpperCase()}
          </div>
        )}

        <div>
          <div className="chat-user-name">
            <strong>{conversation.title}</strong>
            {conversation.other_verified && <ShieldCheck size={14} />}
          </div>
          <span>
            {conversation.other_presence === "online" ? "Online" : "Offline"}
          </span>
        </div>
      </Link>

      <div className="chat-header-actions">
        <button type="button" onClick={onAudioCall} aria-label="Chamada de áudio">
          <Phone size={20} />
        </button>
        <button type="button" onClick={onVideoCall} aria-label="Chamada de vídeo">
          <Video size={20} />
        </button>
        <button type="button" aria-label="Mais opções">
          <MoreVertical size={20} />
        </button>
      </div>
    </header>
  );
}
