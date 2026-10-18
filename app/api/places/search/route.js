import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { searchPublicPlaces } from "@/lib/openStreetMap";

const lastRequestByUser = new Map();

export async function GET(request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() || "";

  if (query.length < 3 || query.length > 100) {
    return NextResponse.json(
      { error: "Digite entre 3 e 100 caracteres." },
      { status: 400 }
    );
  }

  const now = Date.now();
  const lastRequest = lastRequestByUser.get(user.id) || 0;

  if (now - lastRequest < 1100) {
    return NextResponse.json(
      { error: "Espere um instante antes de pesquisar novamente." },
      { status: 429 }
    );
  }

  lastRequestByUser.set(user.id, now);

  try {
    const places = await searchPublicPlaces(query);
    return NextResponse.json({ places });
  } catch {
    return NextResponse.json(
      { error: "A busca de locais está temporariamente indisponível." },
      { status: 502 }
    );
  }
}
