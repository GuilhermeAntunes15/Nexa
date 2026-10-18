"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Brand from "@/components/Brand";
import Button from "@/components/Button";
import Input from "@/components/Input";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (name.trim().length < 2) {
      setError("Digite seu nome.");
      return;
    }

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          name: name.trim()
        }
      }
    });

    if (signUpError) {
      setError(signUpError.message || "Não conseguimos criar sua conta.");
      setLoading(false);
      return;
    }

    if (data.session) {
      router.replace("/onboarding");
      router.refresh();
      return;
    }

    setSuccess("Conta criada. Confira seu e-mail para confirmar o cadastro.");
    setLoading(false);
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <Brand />

        <section className="auth-card nexa-card">
          <h1>Crie seu espaço no Nexa.</h1>
          <p>Depois do cadastro, você completa seu perfil em poucos passos.</p>

          <form className="auth-form" onSubmit={submit}>
            <Input
              id="signup-name"
              label="Nome"
              autoComplete="name"
              required
              maxLength={80}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            <Input
              id="signup-email"
              label="E-mail"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />

            <Input
              id="signup-password"
              label="Senha"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <Input
              id="signup-confirm"
              label="Confirmar senha"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />

            {error && <div className="form-error">{error}</div>}
            {success && <div className="form-success">{success}</div>}

            <Button disabled={loading}>
              {loading ? "Criando..." : "Criar conta"}
            </Button>
          </form>

          <div className="auth-links">
            <Link href="/entrar">Já tenho conta</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
