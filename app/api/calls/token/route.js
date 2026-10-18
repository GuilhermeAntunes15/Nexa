import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { callId } = await request.json();

  if (!callId) {
    return NextResponse.json({ error: "Call required" }, { status: 400 });
  }

  const { data: call, error } = await supabase
    .from("calls")
    .select("id,conversation_id,status,call_type")
    .eq("id", callId)
    .single();

  if (error || !call) {
    return NextResponse.json({ error: "Call unavailable" }, { status: 404 });
  }

  if (!["ringing", "accepted"].includes(call.status)) {
    return NextResponse.json({ error: "Call ended" }, { status: 403 });
  }

  const { data: member } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", call.conversation_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();

  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    {
      identity: user.id,
      name: profile?.name || "Nexa"
    }
  );

  token.addGrant({
    room: `nexa-call-${call.id}`,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true
  });

  const jwt = await token.toJwt();

  return NextResponse.json({
    token: jwt,
    url: process.env.NEXT_PUBLIC_LIVEKIT_URL,
    callType: call.call_type
  });
}
