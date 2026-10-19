"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import AvatarUploader from "@/components/AvatarUploader";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { NEXA_INTENTIONS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

export default function EditProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [userId, setUserId] = useState("");
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [occupation, setOccupation] = useState("");
  const [languages, setLanguages] = useState("");
  const [intention, setIntention] = useState("");
  const [profileStatus, setProfileStatus] = useState("available");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/entrar");
        return;
      }

      setUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("name,bio,avatar_url,city,region,occupation,languages,current_intention,profile_status")
        .eq("id", user.id)
        .single();

      if (data) {
        setName(data.name || "");
        setBio(data.bio || "");
        setAvatarUrl(data.avatar_url || "");
        setCity(data.city || "");
        setRegion(data.region || "");
        setOccupation(data.occupation || "");
        setLanguages((data.languages || []).join(", "));
        setIntention(data.current_intention || "");
        setProfileStatus(data.profile_status || "available");
      }

      setLoading(false);
    }

    load();
  }, [router, supabase]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    const parsedLanguages = languages
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 10);

    const { error } = await supabase
      .from("profiles")
      .update({
        name: name.trim(),
        bio: bio.trim() || null,
        avatar_url: avatarUrl || null,
        city: city.trim() || null,
        region: region.trim() || null,
        occupation: occupation.trim() || null,
        languages: parsedLanguages,
        current_intention: intention || null,
        profile_status: profileStatus
      })
      .eq("id", userId);

    setMessage(error ? "Não conseguimos salvar." : "Perfil atualizado ✓");
    setSaving(false);

    if (!error) router.refresh();
  }

  if (loading) {
    return <div className="simple-loading">Carregando perfil...</div>;
  }

  return (
    <main className="edit-profile-page">
      <header>
        <span className="badge">Perfil</span>
        <h1>Editar perfil</h1>
      </header>

      <form className="edit-profile-form nexa-card" onSubmit={save}>
        <AvatarUploader userId={userId} value={avatarUrl} onChange={setAvatarUrl} />

        <Input id="edit-name" label="Nome" required maxLength={80} value={name} onChange={(event) => setName(event.target.value)} />

        <div className="input-group">
          <label className="input-label" htmlFor="edit-bio">Bio</label>
          <textarea id="edit-bio" className="nexa-textarea" maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} />
        </div>

        <div className="onboarding-two-columns">
          <Input id="edit-city" label="Cidade" value={city} onChange={(event) => setCity(event.target.value)} />
          <Input id="edit-region" label="Região" value={region} onChange={(event) => setRegion(event.target.value)} />
        </div>

        <Input id="edit-occupation" label="Ocupação" value={occupation} onChange={(event) => setOccupation(event.target.value)} />
        <Input id="edit-languages" label="Idiomas" hint="Separe por vírgulas." value={languages} onChange={(event) => setLanguages(event.target.value)} />

        <div className="input-group">
          <label className="input-label" htmlFor="edit-intention">O que você procura agora?</label>
          <select id="edit-intention" className="nexa-input" value={intention} onChange={(event) => setIntention(event.target.value)}>
            <option value="">Escolha</option>
            {NEXA_INTENTIONS.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </select>
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="edit-status">Disponibilidade</label>
          <select id="edit-status" className="nexa-input" value={profileStatus} onChange={(event) => setProfileStatus(event.target.value)}>
            <option value="available">Disponível</option>
            <option value="busy">Ocupada</option>
            <option value="offline">Offline</option>
          </select>
        </div>

        {message && <div className="form-success">{message}</div>}

        <Button disabled={saving}>
          {saving ? "Salvando..." : "Salvar alterações"}
        </Button>
      </form>
    </main>
  );
}
