"use client";

import {useCallback,useEffect,useMemo,useRef,useState} from "react";
import {useParams,useRouter} from "next/navigation";
import ChatHeader from "@/components/ChatHeader";
import ChatComposer from "@/components/ChatComposer";
import MessageBubble from "@/components/MessageBubble";
import IncomingCall from "@/components/IncomingCall";
import {createClient} from "@/lib/supabase/client";

export default function ConversationPage(){
  const {id}=useParams(); const router=useRouter(); const supabase=useMemo(()=>createClient(),[]); const bottomRef=useRef(null);
  const[user,setUser]=useState(null); const[conversation,setConversation]=useState(null); const[messages,setMessages]=useState([]); const[reply,setReply]=useState(null); const[incomingCall,setIncomingCall]=useState(null); const[loading,setLoading]=useState(true);
  const loadMessages=useCallback(async()=>{const{data,error}=await supabase.rpc("get_conversation_messages",{target_conversation:id,p_before:null,p_limit:60});if(!error)setMessages((data||[]).reverse());},[supabase,id]);
  const loadConversation=useCallback(async()=>{const{data,error}=await supabase.rpc("get_conversation_details",{target_conversation:id});if(error||!data?.length){router.replace("/app/conversas");return;}setConversation(data[0]);},[supabase,id,router]);
  useEffect(()=>{async function initialize(){const{data:{user:currentUser}}=await supabase.auth.getUser();if(!currentUser)return;setUser(currentUser);await Promise.all([loadConversation(),loadMessages()]);await supabase.rpc("mark_conversation_read",{target_conversation:id});setLoading(false);}initialize();},[supabase,id,loadConversation,loadMessages]);
  useEffect(()=>{if(!user)return;const messageChannel=supabase.channel(`messages:${id}`).on("postgres_changes",{event:"*",schema:"public",table:"messages",filter:`conversation_id=eq.${id}`},async()=>{await loadMessages();await supabase.rpc("mark_conversation_read",{target_conversation:id});await loadConversation();}).subscribe();const callChannel=supabase.channel(`calls:${id}`).on("postgres_changes",{event:"*",schema:"public",table:"calls",filter:`conversation_id=eq.${id}`},payload=>{const call=payload.new;if(call?.status==="ringing"&&call.initiator_id!==user.id)setIncomingCall(call);if(call?.status==="accepted")setIncomingCall(null);}).subscribe();return()=>{supabase.removeChannel(messageChannel);supabase.removeChannel(callChannel);};},[supabase,id,user,loadMessages,loadConversation]);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages.length]);
  async function requestCall(type){const{data,error}=await supabase.rpc("request_call",{target_conversation:id,p_call_type:type});if(error){console.error(error);alert("Não conseguimos iniciar a chamada.");return;}router.push(`/app/chamadas/${data}`);}
  if(loading||!conversation||!user)return <div className="simple-loading">Abrindo conversa...</div>;
  return <main className="chat-page"><ChatHeader conversation={conversation} onAudioCall={()=>requestCall("audio")} onVideoCall={()=>requestCall("video")}/><section className="chat-messages">{messages.map(message=>{const mine=message.sender_id===user.id;const read=mine&&conversation.other_last_read_at&&new Date(conversation.other_last_read_at)>=new Date(message.created_at);return <MessageBubble key={message.id} message={message} mine={mine} read={Boolean(read)} onReply={setReply}/>;})}<div ref={bottomRef}/></section><ChatComposer conversationId={id} userId={user.id} reply={reply} onClearReply={()=>setReply(null)}/>{incomingCall&&<IncomingCall call={incomingCall} callerName={conversation.title} onClose={()=>setIncomingCall(null)}/>}</main>;
}
