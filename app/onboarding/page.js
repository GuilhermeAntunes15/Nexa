"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";

import Brand from "@/components/Brand";
import Button from "@/components/Button";
import Input from "@/components/Input";
import AvatarUploader from "@/components/AvatarUploader";
import InterestPicker from "@/components/InterestPicker";
import OnboardingProgress from "@/components/OnboardingProgress";
import { NEXA_GOALS, NEXA_INTENTIONS } from "@/lib/constants";
import { calculateAge } from "@/lib/age";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState(null);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [interests, setInterests] = useState([]);
  const [goals, setGoals] = useState([]);
  const [intention, setIntention] = useState("");

  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianRelationship, setGuardianRelationship] = useState("");

  const age = calculateAge(birthDate);
  const isMinor = age !== null && age < 18;

  useEffect(() => {
    async function load() {
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      if (!currentUser) {
        router.replace("/entrar");
        return;
      }

      setUser(currentUser);

      const [profileResult, interestsResult, goalsResult, guardianResult] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("name,birth_date,bio,avatar_url,city,region,current_intention,onboarding_completed")
            .eq("id", currentUser.id)
            .single(),

          supabase
            .from("profile_interests")
            .select("interest_id")
            .eq("user_id", currentUser.id),

          supabase
            .from("profile_goals")
            .select("goal")
            .eq("user_id", currentUser.id),

          supabase
            .from("guardian_links")
            .select("guardian_name,guardian_phone,guardian_email,relationship,status")
            .eq("minor_user_id", currentUser.id)
            .in("status", ["pending", "verified"])
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
        ]);

      const profile = profileResult.data;

      if (profile?.onboarding_completed) {
        router.replace("/app/mapa");
        return;
      }

      setName(profile?.name || currentUser.user_metadata?.name || "");
      setBirthDate(profile?.birth_date || "");
      setBio(profile?.bio || "");
      setAvatarUrl(profile?.avatar_url || "");
      setCity(profile?.city || "");
      setRegion(profile?.region || "");
      setIntention(profile?.current_intention || "");
      setInterests((interestsResult.data || []).map((item) => item.interest_id));
      setGoals((goalsResult.data || []).map((item) => item.goal));

      if (guardianResult.data) {
        setGuardianName(guardianResult.data.guardian_name || "");
        setGuardianPhone(guardianResult.data.guardian_phone || "");
        setGuardianEmail(guardianResult.data.guardian_email || "");
        setGuardianRelationship(guardianResult.data.relationship || "");
      }

      setLoading(false);
    }

    load();
  }, [router, supabase]);

  async function saveBasic() {
    if (name.trim().length < 2) {
      throw new Error("Digite seu nome.");
    }

    if (!birthDate) {
      throw new Error("Informe sua data de nascimento.");
    }

    const calculatedAge = calculateAge(birthDate);

    if (calculatedAge === null || calculatedAge < 13) {
      throw new Error("Esta versão do Nexa não está disponível para essa idade.");
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        name: name.trim(),
        birth_date: birthDate,
        bio: bio.trim() || null,
        city: city.trim() || null,
        region: region.trim() || null
      })
      .eq("id", user.id);

    if (updateError) throw updateError;
  }

  async function saveAvatar() {
    if (!avatarUrl) {
      throw new Error("Escolha uma foto para continuar.");
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user.id);

    if (updateError) throw updateError;
  }

  async function saveInterests() {
    if (interests.length < 3) {
      throw new Error("Escolha pelo menos 3 interesses.");
    }

    const { error: deleteError } = await supabase
      .from("profile_interests")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase
      .from("profile_interests")
      .insert(
        interests.map((interestId) => ({
          user_id: user.id,
          interest_id: interestId
        }))
      );

    if (insertError) throw insertError;
  }

  async function saveGoals() {
    if (!goals.length) {
      throw new Error("Escolha pelo menos um objetivo.");
    }

    const { error: deleteError } = await supabase
      .from("profile_goals")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) throw deleteError;

    const { error: insertError } = await supabase
      .from("profile_goals")
      .insert(
        goals.map((goal) => ({
          user_id: user.id,
          goal
        }))
      );

    if (insertError) throw insertError;
  }

  async function saveIntention() {
    if (!intention) {
      throw new Error("Escolha o que você procura agora.");
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ current_intention: intention })
      .eq("id", user.id);

    if (updateError) throw updateError;
  }

  async function saveGuardian() {
    if (!isMinor) return;

    if (
      guardianName.trim().length < 2 ||
      (!guardianPhone.trim() && !guardianEmail.trim()) ||
      !guardianRelationship.trim()
    ) {
      throw new Error("Preencha os dados do responsável.");
    }

    const { data: existing } = await supabase
      .from("guardian_links")
      .select("id,status")
      .eq("minor_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const payload = {
      guardian_name: guardianName.trim(),
      guardian_phone: guardianPhone.trim() || null,
      guardian_email: guardianEmail.trim().toLowerCase() || null,
      relationship: guardianRelationship.trim(),
      status: "pending"
    };

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("guardian_links")
        .update(payload)
        .eq("id", existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from("guardian_links")
        .insert({
          minor_user_id: user.id,
          ...payload
        });

      if (insertError) throw insertError;
    }
  }

  async function next() {
    if (!user || saving) return;

    setSaving(true);
    setError("");

    try {
      if (step === 1) await saveBasic();
      if (step === 2) await saveAvatar();
      if (step === 3) await saveInterests();
      if (step === 4) await saveGoals();
      if (step === 5) await saveIntention();
      if (step === 6) await saveGuardian();

      if (step < 7) {
        setStep((current) => current + 1);
      }
    } catch (caughtError) {
      setError(caughtError.message || "Não conseguimos salvar esta etapa.");
    }

    setSaving(false);
  }

  async function finish() {
    setSaving(true);
    setError("");

    try {
      await saveBasic();
      await saveAvatar();
      await saveInterests();
      await saveGoals();
      await saveIntention();
      await saveGuardian();

      const { error: finishError } = await supabase.rpc("finish_onboarding");
      if (finishError) throw finishError;

      router.replace("/app/mapa");
      router.refresh();
    } catch (caughtError) {
      if (caughtError.message?.includes("Minimum age")) {
        setError("Esta versão do Nexa não está disponível para essa idade.");
      } else if (caughtError.message?.includes("Guardian")) {
        setError("Adicione um responsável para concluir o Modo Protegido.");
      } else {
        setError(caughtError.message || "Não conseguimos concluir seu perfil.");
      }
    }

    setSaving(false);
  }

  function toggleGoal(goal) {
    setGoals((current) =>
      current.includes(goal)
        ? current.filter((item) => item !== goal)
        : [...current, goal]
    );
  }

  if (loading || !user) {
    return <div className="simple-loading">Preparando seu perfil...</div>;
  }

  return (
    <main className="onboarding-page">
      <div className="onboarding-shell">
        <Brand />
        <OnboardingProgress step={step} total={7} />

        <section className="onboarding-card nexa-card">
          {step === 1 && (
            <>
              <span className="badge">Sobre você</span>
              <h1>Comece pelo essencial.</h1>

              <div className="onboarding-fields">
                <Input id="onboarding-name" label="Nome" required value={name} onChange={(event) => setName(event.target.value)} />
                <Input id="onboarding-birth" label="Data de nascimento" type="date" required value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />

                <div className="input-group">
                  <label className="input-label" htmlFor="onboarding-bio">Bio</label>
                  <textarea id="onboarding-bio" className="nexa-textarea" maxLength={500} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Conte um pouco sobre você..." />
                </div>

                <div className="onboarding-two-columns">
                  <Input id="onboarding-city" label="Cidade" value={city} onChange={(event) => setCity(event.target.value)} />
                  <Input id="onboarding-region" label="Região" value={region} onChange={(event) => setRegion(event.target.value)} />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <span className="badge">Sua foto</span>
              <h1>Escolha como você aparece.</h1>
              <p className="onboarding-description">Use uma foto clara que represente você.</p>

              <AvatarUploader userId={user.id} value={avatarUrl} onChange={setAvatarUrl} />
            </>
          )}

          {step === 3 && (
            <>
              <span className="badge">Interesses</span>
              <h1>O que combina com você?</h1>
              <p className="onboarding-description">Escolha pelo menos três interesses.</p>

              <InterestPicker value={interests} onChange={setInterests} minimum={3} />
            </>
          )}

          {step === 4 && (
            <>
              <span className="badge">Objetivos</span>
              <h1>O que você quer encontrar no Nexa?</h1>

              <div className="goal-grid">
                {NEXA_GOALS.map((goal) => (
                  <button
                    key={goal.value}
                    type="button"
                    className={goals.includes(goal.value) ? "goal-option selected" : "goal-option"}
                    onClick={() => toggleGoal(goal.value)}
                  >
                    {goals.includes(goal.value) && <CheckCircle2 size={17} />}
                    {goal.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <span className="badge">Agora</span>
              <h1>O que você está a fim de fazer?</h1>

              <div className="intention-grid">
                {NEXA_INTENTIONS.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={intention === item.value ? "intention-option selected" : "intention-option"}
                    onClick={() => setIntention(item.value)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 6 && (
            isMinor ? (
              <>
                <span className="badge"><ShieldCheck size={14} /> Modo Protegido</span>
                <h1>Adicione seu responsável.</h1>
                <p className="onboarding-description">Esse vínculo será usado nos recursos presenciais protegidos do Nexa.</p>

                <div className="onboarding-fields">
                  <Input id="guardian-name" label="Nome do responsável" required value={guardianName} onChange={(event) => setGuardianName(event.target.value)} />
                  <Input id="guardian-phone" label="Telefone" type="tel" value={guardianPhone} onChange={(event) => setGuardianPhone(event.target.value)} />
                  <Input id="guardian-email" label="E-mail" type="email" value={guardianEmail} onChange={(event) => setGuardianEmail(event.target.value)} />
                  <Input id="guardian-relationship" label="Relação" required placeholder="Ex.: mãe, pai, responsável" value={guardianRelationship} onChange={(event) => setGuardianRelationship(event.target.value)} />
                </div>
              </>
            ) : (
              <div className="onboarding-safe-info">
                <ShieldCheck size={42} />
                <h1>Segurança configurada.</h1>
                <p>Seu perfil é adulto. Você poderá ajustar privacidade e recursos de segurança dentro do aplicativo.</p>
              </div>
            )
          )}

          {step === 7 && (
            <>
              <span className="badge">Tudo pronto</span>
              <h1>Seu Nexa começa aqui.</h1>

              <div className="onboarding-summary">
                <SummaryRow label="Nome" value={name} />
                <SummaryRow label="Idade" value={age !== null ? `${age} anos` : "-"} />
                <SummaryRow label="Interesses" value={`${interests.length} escolhidos`} />
                <SummaryRow label="Objetivos" value={`${goals.length} escolhidos`} />
                <SummaryRow label="Intenção" value={NEXA_INTENTIONS.find((item) => item.value === intention)?.label || "-"} />
                {isMinor && <SummaryRow label="Modo Protegido" value="Responsável adicionado" />}
              </div>
            </>
          )}

          {error && <div className="form-error onboarding-error">{error}</div>}

          <div className="onboarding-actions">
            {step > 1 ? (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => {
                  setError("");
                  setStep((current) => current - 1);
                }}
              >
                <ArrowLeft size={17} />
                Voltar
              </button>
            ) : <span />}

            {step < 7 ? (
              <Button type="button" disabled={saving} onClick={next}>
                {saving ? "Salvando..." : "Continuar"}
                {!saving && <ArrowRight size={17} />}
              </Button>
            ) : (
              <Button type="button" disabled={saving} onClick={finish}>
                {saving ? "Finalizando..." : "Entrar no Nexa"}
              </Button>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
