import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { retrievePublicPlace } from "@/lib/openStreetMap";

export async function POST(request) {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json();
  const { activityId, expectedEndAt, placeId } = body;

  if (!activityId || !expectedEndAt || !placeId) {
    return NextResponse.json(
      { error: "Preencha o local e o horário do encontro." },
      { status: 400 }
    );
  }

  const expectedEndDate = new Date(expectedEndAt);
  if (Number.isNaN(expectedEndDate.getTime())) {
    return NextResponse.json(
      { error: "A previsão de término é inválida." },
      { status: 400 }
    );
  }

  let place;

  try {
    place = await retrievePublicPlace(placeId);
  } catch {
    return NextResponse.json(
      { error: "O serviço de locais está temporariamente indisponível." },
      { status: 502 }
    );
  }

  if (!place) {
    return NextResponse.json(
      { error: "Escolha um local público válido nas sugestões." },
      { status: 400 }
    );
  }

  const { data, error } = await admin.rpc(
    "service_create_meeting_from_activity",
    {
      p_creator: user.id,
      p_activity_id: activityId,
      p_expected_end_at: expectedEndDate.toISOString(),
      p_place_provider: "openstreetmap",
      p_place_id: place.placeId,
      p_place_name: place.name,
      p_place_address: place.address,
      p_place_lat: place.latitude,
      p_place_lng: place.longitude,
      p_place_categories: place.categories,
    }
  );

  if (error) {
    return NextResponse.json(
      { error: error.message || "Não conseguimos criar o encontro." },
      { status: 400 }
    );
  }

  return NextResponse.json({ meetingId: data });
}
