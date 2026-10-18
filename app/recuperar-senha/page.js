"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import Brand from "@/components/Brand";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { createClient } from "@/lib/supabase/client";

export default function RecoverPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/atualizar-senha`
      }
    );

    if (resetError) {
      setError("Não conseguimos enviar o link agora.");
    } else {
      setMessage("Se esse e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
    }

    setLoading(false);
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <Brand />

        <section className="auth-card nexa-card">
          <h1>Recuperar senha</h1>
          <p>Digite o e-mail usado na sua conta.</p>

          <form className="auth-form" onSubmit={submit}>
            <Input id="recover-email" label="E-mail" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            {error && <div className="form-error">{error}</div>}
            {message && <div className="form-success">{message}</div>}
            <Button disabled={loading}>{loading ? "Enviando..." : "Enviar link"}</Button>
          </form>

          <div className="auth-links">
            <Link href="/entrar">Voltar para entrar</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
