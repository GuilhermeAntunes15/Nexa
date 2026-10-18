"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Heart, MessageCircle, ShieldCheck } from "lucide-react";
import SignedImage from "@/components/SignedImage";
import { createClient } from "@/lib/supabase/client";

export default function FeedPost({post,onChanged}){
  const supabase=useMemo(()=>createClient(),[]); const [loading,setLoading]=useState(false);
  async function react(){ if(loading)return; setLoading(true); await supabase.rpc("toggle_feed_reaction",{target_post:post.post_id}); await onChanged?.(); setLoading(false); }
  return <article className="feed-post nexa-card">
    <Link href={`/app/perfil/${post.author_id}`} className="feed-author">
      {post.author_avatar?<img src={post.author_avatar} alt=""/>:<div className="mini-avatar-fallback">{post.author_name?.charAt(0)?.toUpperCase()}</div>}
      <div><strong>{post.author_name}</strong><span>{formatDate(post.created_at)}</span></div>
      {post.author_verified&&<ShieldCheck size={15}/>}
    </Link>
    <p className="feed-post-content">{post.content}</p>
    {post.media_path&&<SignedImage path={post.media_path} alt="Imagem da publicação" className="feed-post-image"/>}
    <div className="feed-post-actions">
      <button type="button" className={post.reacted?"feed-action active":"feed-action"} disabled={loading} onClick={react}><Heart size={18} fill={post.reacted?"currentColor":"none"}/>{post.reaction_count} apoiaram</button>
      <button type="button" className="feed-action"><MessageCircle size={18}/>{post.comment_count}</button>
    </div>
  </article>;
}
function formatDate(value){return new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(value));}
