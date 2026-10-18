"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { BriefcaseBusiness, Languages, MapPin, ShieldCheck, Star } from "lucide-react";

import ProfileActions from "@/components/ProfileActions";
import ProfileSafetyActions from "@/components/ProfileSafetyActions";
import { MAP_INTENTION_LABELS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

export default function PublicProfilePage() {
  const { id } = useParams();
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase.rpc("get_public_profile", { target_user: id });
      if (active && !error) setProfile(data?.[0] || null);
      if (active) setLoading(false);
    }
    load();
    return () => { active = false; };
  }, [id, supabase]);

  if (loading) return <div className="simple-loading">Carregando perfil...</div>;
  if (!profile) return <div className="simple-loading">Este perfil não está disponível.</div>;

  return (
    <main className="public-profile-page">
      <section className="public-profile-card nexa-card">
        <div className="public-profile-header">
          <div className="public-profile-avatar">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={`Foto de ${profile.name || "perfil"}`} />
            ) : (
              <span>{profile.name?.slice(0, 1) || "N"}</span>
            )}
          </div>
          <div>
            <div className="public-profile-name">
              <h1>{profile.name || "Usuária Nexa"}{profile.age ? `, ${profile.age}` : ""}</h1>
              {profile.is_verified && <ShieldCheck size={20} aria-label="Perfil verificado" />}
            </div>
            {profile.username && <p>@{profile.username}</p>}
            {(profile.city || profile.region) && <span><MapPin size={16} />{[profile.city, profile.region].filter(Boolean).join(" · ")}</span>}
          </div>
        </div>

        {profile.bio && <p className="public-profile-bio">{profile.bio}</p>}

        <div className="public-profile-meta">
          {profile.occupation && <span><BriefcaseBusiness size={17} />{profile.occupation}</span>}
          {profile.languages?.length > 0 && <span><Languages size={17} />{profile.languages.join(", ")}</span>}
          <span><Star size={17} />{Number(profile.trust_score || 0).toFixed(0)}% de confiança · {profile.review_count || 0} avaliações</span>
        </div>

        {profile.current_intention && (
          <div className="public-intention">
            Agora: <strong>{MAP_INTENTION_LABELS[profile.current_intention] || profile.current_intention}</strong>
          </div>
        )}

        {profile.interests?.length > 0 && (
          <div className="public-tags">{profile.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
        )}

        <ProfileActions userId={id} />
      </section>

      <ProfileSafetyActions userId={id} userName={profile.name || "Esta pessoa"} />
    </main>
  );
}
