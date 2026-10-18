"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Brand from "@/components/Brand";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError("O link pode ter expirado. Solicite uma nova recuperação.");
      setLoading(false);
      return;
    }

    router.replace("/app/mapa");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <Brand />

        <section className="auth-card nexa-card">
          <h1>Nova senha</h1>
          <p>Escolha uma nova senha para sua conta.</p>

          <form className="auth-form" onSubmit={submit}>
            <Input id="new-password" label="Nova senha" type="password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
            <Input id="confirm-new-password" label="Confirmar senha" type="password" required value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            {error && <div className="form-error">{error}</div>}
            <Button disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</Button>
          </form>
        </section>
      </div>
    </main>
  );
}
