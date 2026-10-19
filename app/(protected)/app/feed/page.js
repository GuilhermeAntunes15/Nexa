"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import Link from "next/link";
import {CalendarPlus,Plus} from "lucide-react";
import ActivityCard from "@/components/ActivityCard";
import FeedPost from "@/components/FeedPost";
import {createClient} from "@/lib/supabase/client";

export default function FeedPage(){
  const supabase=useMemo(()=>createClient(),[]); const [activities,setActivities]=useState([]); const [posts,setPosts]=useState([]); const [tab,setTab]=useState("all"); const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{const [activityResult,postResult]=await Promise.all([supabase.rpc("get_activity_feed",{p_limit:30}),supabase.rpc("get_feed_posts",{p_limit:30})]); if(!activityResult.error)setActivities(activityResult.data||[]); if(!postResult.error)setPosts(postResult.data||[]); setLoading(false);},[supabase]);
  useEffect(()=>{load(); const activityChannel=supabase.channel("feed-activities").on("postgres_changes",{event:"*",schema:"public",table:"activities"},load).on("postgres_changes",{event:"*",schema:"public",table:"activity_members"},load).subscribe(); const postChannel=supabase.channel("feed-posts").on("postgres_changes",{event:"*",schema:"public",table:"feed_posts"},load).on("postgres_changes",{event:"*",schema:"public",table:"feed_reactions"},load).subscribe(); return()=>{supabase.removeChannel(activityChannel);supabase.removeChannel(postChannel);};},[supabase,load]);
  return <main className="feed-page">
    <header className="feed-header"><div><span className="badge">Nexa</span><h1>Descobrir</h1><p>Atividades, ideias e conexões para fazer acontecer.</p></div><Link href="/app/criar" className="feed-create-button"><Plus size={20}/></Link></header>
    <nav className="feed-tabs"><button type="button" className={tab==="all"?"active":""} onClick={()=>setTab("all")}>Para você</button><button type="button" className={tab==="activities"?"active":""} onClick={()=>setTab("activities")}>Rolês</button><button type="button" className={tab==="posts"?"active":""} onClick={()=>setTab("posts")}>Comunidade</button></nav>
    {loading?<div className="simple-loading">Atualizando seu Feed...</div>:<section className="feed-stream">{(tab==="all"||tab==="activities")&&activities.map(activity=><ActivityCard key={activity.activity_id} activity={activity} onChanged={load}/>)}{(tab==="all"||tab==="posts")&&posts.map(post=><FeedPost key={post.post_id} post={post} onChanged={load}/>)}{!activities.length&&!posts.length&&<div className="feed-empty nexa-card"><CalendarPlus size={36}/><h2>Comece o movimento</h2><p>Crie o primeiro rolê ou publique algo na comunidade.</p><Link href="/app/criar" className="btn btn-primary">Criar</Link></div>}</section>}
  </main>;
}
