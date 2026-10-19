"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PhoneOff } from "lucide-react";
import LiveCall from "@/components/LiveCall";
import { createClient } from "@/lib/supabase/client";

export default function CallPage() {
  const { id } = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [token, setToken] = useState("");
  const [serverUrl, setServerUrl] = useState("");
  const [callType, setCallType] = useState("");
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/calls/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId: id })
      });

      if (!response.ok) {
        setStatus("error");
        return;
      }

      const data = await response.json();
      setToken(data.token);
      setServerUrl(data.url);
      setCallType(data.callType);
      setStatus("ready");
    }

    load();

    const channel = supabase
      .channel(`active-call:${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "calls",
          filter: `id=eq.${id}`
        },
        (payload) => {
          if (["ended", "declined", "missed"].includes(payload.new.status)) {
            router.replace("/app/conversas");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, router, supabase]);

  async function endCall() {
    await supabase.rpc("end_call", { target_call: id });
    router.replace("/app/conversas");
  }

  if (status === "loading") {
    return <div className="call-loading">Preparando chamada...</div>;
  }

  if (status === "error") {
    return <div className="call-loading">Esta chamada não está mais disponível.</div>;
  }

  return (
    <main className="call-page">
      <LiveCall
        token={token}
        serverUrl={serverUrl}
        video={callType === "video"}
      />
      <button type="button" className="nexa-end-call" onClick={endCall}>
        <PhoneOff size={20} />
        Encerrar
      </button>
    </main>
  );
}
