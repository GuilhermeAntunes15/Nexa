"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Brand from "@/components/Brand";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password
    });

    if (loginError || !data.user) {
      setError("E-mail ou senha inválidos.");
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed,account_status")
      .eq("id", data.user.id)
      .single();

    if (profile?.account_status && profile.account_status !== "active") {
      await supabase.auth.signOut();
      setError("Esta conta não está disponível no momento.");
      setLoading(false);
      return;
    }

    router.replace(profile?.onboarding_completed ? "/app/mapa" : "/onboarding");
    router.refresh();
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <Brand />

        <section className="auth-card nexa-card">
          <h1>Bem-vinda de volta.</h1>
          <p>Entre para continuar suas conexões no Nexa.</p>

          <form className="auth-form" onSubmit={submit}>
            <Input id="login-email" label="E-mail" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            <Input id="login-password" label="Senha" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />

            {error && <div className="form-error">{error}</div>}

            <Button disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
          </form>

          <div className="auth-links">
            <Link href="/recuperar-senha">Esqueci minha senha</Link>
            <Link href="/cadastro">Criar conta</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
