import Link from "next/link";
import { HeartHandshake, MapPinned, ShieldCheck, UsersRound } from "lucide-react";
import Brand from "@/components/Brand";

export default function HomePage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav">
        <Brand />
        <div className="landing-actions">
          <Link href="/entrar" className="btn btn-secondary">Entrar</Link>
          <Link href="/cadastro" className="btn btn-primary">Criar conta</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span className="badge">Mulheres conectando mulheres</span>
          <h1>Conexões que saem da tela e viram apoio real.</h1>
          <p>Descubra pessoas próximas, encontre companhia para atividades, troque experiências e use recursos de segurança pensados para encontros presenciais.</p>
          <div className="hero-actions">
            <Link href="/cadastro" className="btn btn-primary">Começar no Nexa</Link>
            <Link href="/entrar" className="btn btn-ghost">Já tenho conta</Link>
          </div>
        </div>

        <div className="hero-panel nexa-card">
          <div className="hero-mini-card"><MapPinned size={22}/><strong>Mapa de conexões</strong><span>Descubra perfis próximos sem mostrar sua posição exata.</span></div>
          <div className="hero-mini-card"><UsersRound size={22}/><strong>Rolês e projetos</strong><span>Participe de cafés, estudos, esportes, eventos e projetos.</span></div>
          <div className="hero-mini-card"><HeartHandshake size={22}/><strong>SOS Delas</strong><span>Uma rede de apoio para estudos, trabalho, tecnologia e companhia.</span></div>
          <div className="hero-mini-card"><ShieldCheck size={22}/><strong>Segurança por padrão</strong><span>Privacidade, bloqueios, verificação e encontros protegidos.</span></div>
        </div>
      </section>
    </main>
  );
}
