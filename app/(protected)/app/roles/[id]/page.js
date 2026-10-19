"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  CalendarDays,
  MapPin,
  MessageCircle,
  ShieldCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";

import InviteActivityModal from "@/components/InviteActivityModal";
import SignedImage from "@/components/SignedImage";
import { createClient } from "@/lib/supabase/client";

export default function ActivityPage() {
  const { id } = useParams();
  const supabase = useMemo(() => createClient(), []);
  const [activity, setActivity] = useState(null);
  const [inviting, setInviting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("get_activity_details", {
      target_activity: id,
    });
    if (!error) setActivity(data?.[0] || null);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`activity:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "activity_members",
          filter: `activity_id=eq.${id}`,
        },
        load
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [id, load, supabase]);

  async function join() {
    await supabase.rpc("join_activity", { target_activity: id });
    load();
  }

  if (loading) return <div className="simple-loading">Carregando rolê...</div>;
  if (!activity) return <div className="simple-loading">Este rolê não está disponível.</div>;

  return (
    <main className="activity-page">
      {activity.cover_path && (
        <SignedImage path={activity.cover_path} alt="" className="activity-detail-cover" />
      )}
      <div className="activity-detail-body">
        <span className="badge">{activity.category || "Rolê"}</span>
        <h1>{activity.title}</h1>
        <Link href={`/app/perfil/${activity.creator_id}`} className="activity-organizer">
          Organizado por <strong>{activity.creator_name}</strong>
        </Link>
        <div className="activity-detail-info">
          <span><CalendarDays size={18} />{new Date(activity.starts_at).toLocaleString("pt-BR")}</span>
          <span><MapPin size={18} />{activity.region}</span>
          <span>
            <UsersRound size={18} />
            {activity.participant_count}
            {activity.max_participants ? `/${activity.max_participants}` : ""} participantes
          </span>
        </div>
        {activity.description && (
          <section className="activity-about">
            <h2>Sobre o rolê</h2>
            <p>{activity.description}</p>
          </section>
        )}
        <div className="activity-detail-actions">
          {!activity.joined && (
            <button className="btn btn-primary" type="button" onClick={join}>Participar</button>
          )}
          {activity.joined && activity.group_conversation_id && (
            <Link href={`/app/conversas/${activity.group_conversation_id}`} className="btn btn-primary">
              <MessageCircle size={18} />Grupo do rolê
            </Link>
          )}
          {activity.joined && (
            <button className="btn btn-secondary" type="button" onClick={() => setInviting(true)}>
              <UserPlus size={18} />Convidar
            </button>
          )}
          {activity.joined && (
            <Link
              href={`/app/seguranca/encontros/novo?activity=${id}`}
              className="btn btn-secondary"
            >
              <ShieldCheck size={18} />Preparar encontro
            </Link>
          )}
        </div>
      </div>
      {inviting && (
        <InviteActivityModal activityId={id} onClose={() => setInviting(false)} />
      )}
    </main>
  );
}
