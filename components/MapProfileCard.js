"use client";

import {
  useMemo,
  useState
} from "react";

import Link from "next/link";

import {
  MapPin,
  ShieldCheck,
  UserPlus,
  X
} from "lucide-react";

import {
  createClient
} from "@/lib/supabase/client";

import {
  MAP_INTENTION_LABELS
} from "@/lib/constants";

export default function MapProfileCard({
  profile,
  onClose
}) {
  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );

  const [
    connectionStatus,
    setConnectionStatus
  ] =
    useState("");

  const [
    loading,
    setLoading
  ] =
    useState(false);

  if (!profile)
    return null;

  async function connect() {
    if (loading)
      return;

    setLoading(true);

    setConnectionStatus("");

    const {
      error
    } =
      await supabase.rpc(
        "request_connection",
        {
          target_user:
            profile.user_id,

          request_reason:
            "Mapa Nexa"
        }
      );

    if (error) {
      console.error(
        error
      );

      setConnectionStatus(
        "Não conseguimos enviar a conexão."
      );
    } else {
      setConnectionStatus(
        "Solicitação enviada ✓"
      );
    }

    setLoading(false);
  }

  return (
    <aside className="map-profile-card">
      <button
        type="button"
        className="map-card-close"
        onClick={onClose}
      >
        <X size={18} />
      </button>

      <div className="map-profile-main">
        {profile.avatar_url ? (
          <img
            className="map-profile-avatar"
            src={
              profile.avatar_url
            }
            alt={
              profile.name
            }
          />
        ) : (
          <div className="map-profile-avatar map-avatar-fallback">
            {profile.name
              ?.charAt(0)
              ?.toUpperCase()}
          </div>
        )}

        <div className="map-profile-info">
          <div className="map-profile-name">
            <strong>
              {profile.name}

              {profile.age_years
                ? `, ${profile.age_years}`
                : ""}
            </strong>

            {profile.is_verified && (
              <ShieldCheck
                size={17}
              />
            )}
          </div>

          <span className="map-intention">
            {
              MAP_INTENTION_LABELS[
                profile.current_intention
              ] ||
              "Disponível"
            }
          </span>

          <div className="map-distance">
            <MapPin size={15} />

            {
              profile.distance_label
            }
          </div>
        </div>
      </div>

      {connectionStatus && (
        <div className="map-status-message">
          {connectionStatus}
        </div>
      )}

      <div className="map-profile-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading}
          onClick={connect}
        >
          <UserPlus size={17} />

          {loading
            ? "Enviando..."
            : "Conectar"}
        </button>

        <Link
          href={
            `/app/perfil/${profile.user_id}`
          }
          className="btn btn-secondary"
        >
          Ver perfil
        </Link>
      </div>
    </aside>
  );
}
