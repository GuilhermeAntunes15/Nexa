"use client";

import { useMemo, useState } from "react";
import { Phone, PhoneOff, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function IncomingCall({ call, callerName, onClose }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(false);

  async function respond(accept) {
    setLoading(true);

    const { error } = await supabase.rpc("respond_call", {
      target_call: call.id,
      p_accept: accept
    });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    if (accept) {
      router.push(`/app/chamadas/${call.id}`);
    } else {
      onClose?.();
    }

    setLoading(false);
  }

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-card">
        <div className="incoming-call-icon">
          {call.call_type === "video" ? <Video size={31} /> : <Phone size={31} />}
        </div>
        <span>{call.call_type === "video" ? "Chamada de vídeo" : "Chamada de áudio"}</span>
        <h2>{callerName}</h2>
        <div className="incoming-call-actions">
          <button
            type="button"
            className="call-decline"
            disabled={loading}
            onClick={() => respond(false)}
          >
            <PhoneOff size={22} />
            Recusar
          </button>
          <button
            type="button"
            className="call-accept"
            disabled={loading}
            onClick={() => respond(true)}
          >
            <Phone size={22} />
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
