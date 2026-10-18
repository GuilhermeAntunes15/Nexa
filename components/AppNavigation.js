"use client";

import Link from "next/link";
import {
  Bell,
  HeartHandshake,
  Map,
  MessageCircle,
  Plus,
  UserRound,
  Waves,
} from "lucide-react";

import useNotifications from "@/hooks/useNotifications";

export default function AppNavigation() {
  const { unread } = useNotifications();

  return (
    <>
      <nav className="app-navigation" aria-label="Navegação principal">
        <Link href="/app/mapa" className="app-nav-item">
          <Map size={22} />
          <span>Mapa</span>
        </Link>
        <Link href="/app/feed" className="app-nav-item">
          <Waves size={22} />
          <span>Feed</span>
        </Link>
        <Link href="/app/criar" className="app-nav-item app-nav-create">
          <Plus size={24} />
          <span>Criar</span>
        </Link>
        <Link href="/app/conversas" className="app-nav-item">
          <MessageCircle size={22} />
          <span>Conversas</span>
        </Link>
        <Link href="/app/perfil" className="app-nav-item">
          <UserRound size={22} />
          <span>Perfil</span>
        </Link>
        <Link href="/app/notificacoes" className="app-nav-item">
          <div className="nav-icon-wrapper">
            <Bell size={22} />
            {unread > 0 && (
              <span className="nav-badge">{unread > 99 ? "99+" : unread}</span>
            )}
          </div>
          <span>Avisos</span>
        </Link>
      </nav>

      <Link href="/app/sos" className="sos-floating">
        <HeartHandshake size={20} />
        SOS Delas
      </Link>
    </>
  );
}
