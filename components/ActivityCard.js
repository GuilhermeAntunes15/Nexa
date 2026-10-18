"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, ShieldCheck, UsersRound } from "lucide-react";
import SignedImage from "@/components/SignedImage";
import { createClient } from "@/lib/supabase/client";

export default function ActivityCard({ activity, onChanged }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");

  async function join(){
    if(loading)return;
    setLoading(true);setMessage("");
    const {error}=await supabase.rpc("join_activity",{target_activity:activity.activity_id});
    if(error){
      console.error(error);
      setMessage(error.message?.toLowerCase().includes("full")?"Esse rolê já está cheio.":"Não conseguimos confirmar sua participação.");
    } else { setMessage("Você está participando 💗"); onChanged?.(); }
    setLoading(false);
  }

  return <article className="activity-card nexa-card">
    {activity.cover_path && <SignedImage path={activity.cover_path} alt="" className="activity-cover" />}
    <div className="activity-card-body">
      <div className="activity-author">
        {activity.creator_avatar?<img src={activity.creator_avatar} alt=""/>:<div className="mini-avatar-fallback">{activity.creator_name?.charAt(0)?.toUpperCase()}</div>}
        <strong>{activity.creator_name}</strong>{activity.creator_verified&&<ShieldCheck size={15}/>}
      </div>
      <Link href={`/app/roles/${activity.activity_id}`}><h2>{activity.title}</h2></Link>
      {activity.description&&<p className="activity-description">{activity.description}</p>}
      <div className="activity-details">
        <span><CalendarDays size={15}/>{formatDate(activity.starts_at)}</span>
        {activity.region&&<span><MapPin size={15}/>{activity.region}</span>}
        <span><UsersRound size={15}/>{activity.participant_count}{activity.max_participants?`/${activity.max_participants}`:""}</span>
      </div>
      {message&&<div className="activity-feedback">{message}</div>}
      <div className="activity-card-actions">
        {activity.already_joined?<Link href={`/app/roles/${activity.activity_id}`} className="btn btn-secondary">Ver rolê</Link>:<button type="button" className="btn btn-primary" disabled={loading||activity.status==="full"} onClick={join}>{activity.status==="full"?"Lotado":loading?"Entrando...":"Participar"}</button>}
      </div>
    </div>
  </article>;
}
function formatDate(value){ return new Intl.DateTimeFormat("pt-BR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value)); }
