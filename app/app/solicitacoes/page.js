"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Clock3, UserRoundPlus, X } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export default function RequestsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_my_connection_requests");
    if (!error) setRequests(data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel("connection-requests-page")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connection_requests" },
        load
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [load, supabase]);

  async function respond(requestId, action) {
    setWorkingId(requestId);
    const rpc = action === "accept" ? "accept_connection_request" : "decline_connection_request";
    const { data, error } = await supabase.rpc(rpc, { request_id: requestId });
    setWorkingId(null);
    if (!error && action === "accept" && data) {
      window.location.href = `/app/conversas/${data}`;
      return;
    }
    if (!error) load();
  }

  if (loading) return <div className="simple-loading">Carregando solicitações...</div>;

  return (
    <main className="requests-page">
      <header>
        <span className="badge">Conexões</span>
        <h1>Solicitações</h1>
        <p>Aceite apenas pessoas com quem você se sente confortável.</p>
      </header>

      {!requests.length ? (
        <section className="requests-empty nexa-card">
          <UserRoundPlus size={34} />
          <h2>Nenhuma solicitação pendente</h2>
          <p>Quando alguém quiser se conectar, o pedido aparecerá aqui.</p>
          <Link href="/app/mapa" className="btn btn-secondary">Explorar o mapa</Link>
        </section>
      ) : (
        <section className="requests-list">
          {requests.map((request) => (
            <article key={request.request_id} className="request-card nexa-card">
              <div className="request-avatar">
                {request.sender_avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={request.sender_avatar_url} alt="" />
                ) : (
                  <span>{request.sender_name?.slice(0, 1) || "N"}</span>
                )}
              </div>
              <div className="request-copy">
                <Link href={`/app/perfil/${request.sender_id}`}>
                  <strong>{request.sender_name || "Usuária Nexa"}</strong>
                  {request.sender_username && <span>@{request.sender_username}</span>}
                </Link>
                {request.request_reason && <p>{request.request_reason}</p>}
                <small><Clock3 size={14} />{new Date(request.created_at).toLocaleString("pt-BR")}</small>
              </div>
              <div className="request-actions">
                <button type="button" className="btn btn-primary" disabled={workingId === request.request_id} onClick={() => respond(request.request_id, "accept")}>
                  <Check size={17} />Aceitar
                </button>
                <button type="button" className="btn btn-ghost" disabled={workingId === request.request_id} onClick={() => respond(request.request_id, "decline")}>
                  <X size={17} />Recusar
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
