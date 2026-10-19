"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@/components/Button";
import Input from "@/components/Input";
import { createClient } from "@/lib/supabase/client";

function getCreateActivityErrorMessage(error) {
  const message = error?.message?.trim();
  const normalized = message?.toLowerCase() || "";

  if (normalized.includes("activity must be in the future")) {
    return "Escolha uma data e um horário futuros.";
  }

  if (normalized.includes("invalid end time")) {
    return "O término precisa acontecer depois do início.";
  }

  if (normalized.includes("title too short")) {
    return "O título precisa ter pelo menos 3 caracteres.";
  }

  if (normalized.includes("invalid participant limit")) {
    return "Informe entre 2 e 100 participantes.";
  }

  if (normalized.includes("not authenticated")) {
    return "Sua sessão expirou. Entre novamente e tente de novo.";
  }

  if (normalized.includes("schema cache") || normalized.includes("create_activity")) {
    return "A função de criar rolês não está disponível no banco. Verifique a migration 011.";
  }

  return message || "Não conseguimos criar o rolê.";
}

export default function CreateActivityPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState("hangout");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(5);
  const [region, setRegion] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    const trimmedTitle = title.trim();
    const trimmedRegion = region.trim();
    const participantLimit = Number(maxParticipants);
    const startDate = new Date(startsAt);
    const endDate = endsAt ? new Date(endsAt) : null;

    if (trimmedTitle.length < 3) {
      setError("O título precisa ter pelo menos 3 caracteres.");
      return;
    }

    if (!startsAt || Number.isNaN(startDate.getTime())) {
      setError("Informe quando o rolê começa.");
      return;
    }

    if (startDate.getTime() <= Date.now()) {
      setError("Escolha uma data e um horário futuros.");
      return;
    }

    if (endDate && (Number.isNaN(endDate.getTime()) || endDate <= startDate)) {
      setError("O término precisa acontecer depois do início.");
      return;
    }

    if (!Number.isInteger(participantLimit) || participantLimit < 2 || participantLimit > 100) {
      setError("Informe entre 2 e 100 participantes.");
      return;
    }

    if (!trimmedRegion) {
      setError("Informe uma região aproximada.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: createError } = await supabase.rpc("create_activity", {
        p_title: trimmedTitle,
        p_description: description.trim() || null,
        p_category: category.trim() || null,
        p_activity_type: type,
        p_starts_at: startDate.toISOString(),
        p_ends_at: endDate?.toISOString() || null,
        p_max_participants: participantLimit,
        p_region: trimmedRegion,
        p_visibility: visibility,
        p_cover_path: null
      });

      if (createError) {
        setError(getCreateActivityErrorMessage(createError));
        return;
      }

      router.push(`/app/roles/${data}`);
    } catch (caughtError) {
      setError(getCreateActivityErrorMessage(caughtError));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="create-form-page">
      <header>
        <span className="badge">Novo rolê</span>
        <h1>Vamos fazer acontecer.</h1>
        <p>Use apenas uma região ou local público. Não coloque endereço residencial.</p>
      </header>

      <form className="create-form nexa-card" onSubmit={submit}>
        <Input
          id="activity-title"
          label="Título"
          required
          maxLength={100}
          value={title}
          placeholder="Ex.: Café e conversa na Paulista"
          onChange={(event) => setTitle(event.target.value)}
        />

        <div className="input-group">
          <label className="input-label" htmlFor="activity-description">Descrição</label>
          <textarea
            id="activity-description"
            className="nexa-textarea"
            maxLength={1000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>

        <Input
          id="category"
          label="Categoria"
          value={category}
          placeholder="Café, cinema, estudo..."
          onChange={(event) => setCategory(event.target.value)}
        />

        <div className="input-group">
          <label className="input-label" htmlFor="activity-type">Tipo</label>
          <select
            id="activity-type"
            className="nexa-input"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="hangout">Rolê</option>
            <option value="event">Evento</option>
            <option value="study">Estudos</option>
            <option value="sport">Esporte</option>
            <option value="project">Projeto</option>
            <option value="group">Grupo</option>
          </select>
        </div>

        <Input
          id="starts"
          label="Quando começa?"
          type="datetime-local"
          required
          value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)}
        />

        <Input
          id="ends"
          label="Previsão de término"
          type="datetime-local"
          value={endsAt}
          onChange={(event) => setEndsAt(event.target.value)}
        />

        <Input
          id="participants"
          label="Máximo de participantes"
          type="number"
          min={2}
          max={100}
          value={maxParticipants}
          onChange={(event) => setMaxParticipants(event.target.value)}
        />

        <Input
          id="activity-region"
          label="Região"
          required
          value={region}
          placeholder="Ex.: Paulista"
          onChange={(event) => setRegion(event.target.value)}
        />

        <div className="input-group">
          <label className="input-label" htmlFor="activity-visibility">Quem pode ver?</label>
          <select
            id="activity-visibility"
            className="nexa-input"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value)}
          >
            <option value="public">Pessoas compatíveis</option>
            <option value="connections">Somente conexões</option>
            <option value="private">Somente convidadas</option>
          </select>
        </div>

        {error && <div className="form-error">{error}</div>}

        <Button disabled={loading}>
          {loading ? "Criando..." : "Criar rolê"}
        </Button>
      </form>
    </main>
  );
}
