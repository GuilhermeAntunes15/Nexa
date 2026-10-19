import Link from "next/link";
import { redirect } from "next/navigation";
import { MapPin, Settings, ShieldCheck } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { MAP_INTENTION_LABELS } from "@/lib/constants";

export default async function MyProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const [profileResult, interestResult, goalResult, trustResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,name,bio,avatar_url,city,region,current_intention,is_verified,occupation,languages,profile_status")
      .eq("id", user.id)
      .single(),

    supabase
      .from("profile_interests")
      .select("interests(name)")
      .eq("user_id", user.id),

    supabase
      .from("profile_goals")
      .select("goal")
      .eq("user_id", user.id),

    supabase
      .from("trust_metrics")
      .select("trust_score,review_count")
      .eq("user_id", user.id)
      .maybeSingle()
  ]);

  const profile = profileResult.data;
  if (!profile) redirect("/onboarding");

  return (
    <main className="my-profile-page">
      <section className="profile-hero nexa-card">
        <div className="profile-hero-top">
          {profile.avatar_url ? (
            <img className="profile-main-avatar" src={profile.avatar_url} alt="" />
          ) : (
            <div className="profile-main-avatar profile-avatar-fallback">
              {profile.name?.charAt(0)?.toUpperCase() || "N"}
            </div>
          )}

          <div className="profile-identity">
            <div className="profile-name-line">
              <h1>{profile.name}</h1>
              {profile.is_verified && <ShieldCheck size={20} />}
            </div>

            {(profile.city || profile.region) && (
              <span className="profile-location">
                <MapPin size={15} />
                {[profile.city, profile.region].filter(Boolean).join(" • ")}
              </span>
            )}

            {profile.current_intention && (
              <span className="badge">
                {MAP_INTENTION_LABELS[profile.current_intention] || profile.current_intention}
              </span>
            )}
          </div>
        </div>

        {profile.bio && <p className="profile-bio">{profile.bio}</p>}

        <div className="profile-main-actions">
          <Link href="/app/perfil/editar" className="btn btn-primary">Editar perfil</Link>
          <Link href="/app/configuracoes" className="btn btn-secondary"><Settings size={17} />Configurações</Link>
          <Link href="/app/seguranca" className="btn btn-secondary"><ShieldCheck size={17} />Segurança</Link>
        </div>
      </section>

      <section className="profile-section nexa-card">
        <h2>Interesses</h2>
        <div className="profile-chip-list">
          {(interestResult.data || []).map((item, index) => (
            <span key={`${item.interests?.name}-${index}`}>{item.interests?.name}</span>
          ))}
        </div>
      </section>

      <section className="profile-section nexa-card">
        <h2>Objetivos</h2>
        <div className="profile-chip-list">
          {(goalResult.data || []).map((item) => (
            <span key={item.goal}>{item.goal}</span>
          ))}
        </div>
      </section>

      <section className="profile-section nexa-card">
        <h2>Confiança</h2>
        <div className="profile-stats">
          <div><strong>{Math.round(Number(trustResult.data?.trust_score || 0))}%</strong><span>Índice</span></div>
          <div><strong>{trustResult.data?.review_count || 0}</strong><span>Avaliações</span></div>
        </div>
      </section>
    </main>
  );
}
