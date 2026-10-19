"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  LocateFixed,
  MapPinOff,
  RefreshCw,
  ShieldCheck
} from "lucide-react";

import NexaMap from "@/components/NexaMap";
import MapFilters from "@/components/MapFilters";
import MapProfileCard from "@/components/MapProfileCard";
import useLiveLocation from "@/hooks/useLiveLocation";

import {
  createClient
} from "@/lib/supabase/client";

export default function MapPage() {
  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );

  const {
    position,
    accuracy,
    status,
    error,
    lastSyncAt,
    start
  } =
    useLiveLocation();

  const [
    profiles,
    setProfiles
  ] =
    useState([]);

  const [
    selected,
    setSelected
  ] =
    useState(null);

  const [
    loading,
    setLoading
  ] =
    useState(false);

  const [
    mapError,
    setMapError
  ] =
    useState("");

  const [
    filters,
    setFilters
  ] =
    useState({
      radius: 10,
      intention: "",
      verified: false,
      interests: []
    });

  const refreshTimeout =
    useRef(null);

  const loadNearby =
    useCallback(
      async () => {
        if (!position) {
          return;
        }

        setLoading(true);

        const {
          data,
          error:
            nearbyError
        } =
          await supabase.rpc(
            "get_nearby_profiles",
            {
              p_radius_km:
                filters.radius,

              p_intention:
                filters.intention ||
                null,

              p_verified_only:
                filters.verified,

              p_interest_ids:
                filters
                  .interests
                  .length
                  ? filters.interests
                  : null
            }
          );

        if (
          nearbyError
        ) {
          setMapError(
            nearbyError.message ||
            "Não conseguimos carregar as conexões próximas."
          );

          setLoading(false);

          return;
        }

        setMapError("");

        setProfiles(
          data || []
        );

        setLoading(false);
      },
      [
        supabase,
        position,
        filters
      ]
    );

  useEffect(() => {
    if (
      position &&
      lastSyncAt
    ) {
      loadNearby();
    }
  }, [
    lastSyncAt,
    position,
    loadNearby
  ]);

  useEffect(() => {
    if (!position)
      return;

    const timeout =
      setTimeout(
        () => {
          loadNearby();
        },
        250
      );

    return () =>
      clearTimeout(
        timeout
      );
  }, [
    filters,
    position,
    loadNearby
  ]);

  useEffect(() => {
    if (!position)
      return;

    const channelId =
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const channel =
      supabase
        .channel(
          `nexa-live-map:${channelId}`
        )
        .on(
          "postgres_changes",

          {
            event: "*",
            schema: "public",
            table:
              "user_presence"
          },

          () => {
            if (
              refreshTimeout.current
            ) {
              clearTimeout(
                refreshTimeout.current
              );
            }

            refreshTimeout.current =
              setTimeout(
                () => {
                  loadNearby();
                },
                800
              );
          }
        )
        .subscribe();

    return () => {
      if (
        refreshTimeout.current
      ) {
        clearTimeout(
          refreshTimeout.current
        );
      }

      void supabase
        .removeChannel(
          channel
        );
    };
  }, [
    supabase,
    position,
    loadNearby
  ]);

  if (
    status === "idle"
    ||
    status === "requesting"
  ) {
    return (
      <main className="map-permission-page">
        <div className="map-permission-card">
          <div className="map-permission-icon">
            <LocateFixed size={34} />
          </div>

          <h1>
            Encontrar conexões próximas
          </h1>

          <p>
            O Nexa utiliza sua localização para encontrar pessoas e atividades próximas.
          </p>

          <div className="privacy-map-note">
            <ShieldCheck size={19} />

            <span>
              Sua posição exata não será mostrada para outras usuárias.
            </span>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={start}
            disabled={
              status ===
              "requesting"
            }
          >
            <LocateFixed size={18} />

            {status ===
              "requesting"
              ? "Solicitando..."
              : "Permitir localização"}
          </button>
        </div>
      </main>
    );
  }

  if (
    status === "denied"
    ||
    status === "unsupported"
  ) {
    return (
      <main className="map-permission-page">
        <div className="map-permission-card">
          <div className="map-permission-icon">
            <MapPinOff size={34} />
          </div>

          <h1>
            Localização desativada
          </h1>

          <p>
            Ative a localização do navegador para visualizar conexões próximas.
          </p>

          {error && (
            <div className="form-error">
              {error}
            </div>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            onClick={start}
          >
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="live-map-page">
      <NexaMap
        profiles={profiles}
        myPosition={position}
        selectedId={
          selected?.user_id
        }
        onSelect={
          setSelected
        }
      />

      <MapFilters
        filters={filters}
        onChange={
          setFilters
        }
      />

      <div className="map-live-status">
        <span className="live-dot" />

        Localização ativa

        {accuracy && (
          <small>
            ±
            {Math.round(
              accuracy
            )}
            m
          </small>
        )}
      </div>

      <div className="map-people-count">
        {profiles.length === 1
          ? "1 pessoa próxima"
          : `${profiles.length} pessoas próximas`}
      </div>

      {loading && (
        <div className="map-loading-chip">
          <RefreshCw size={15} />

          Atualizando...
        </div>
      )}

      {mapError && (
        <div className="map-error-toast">
          {mapError}
        </div>
      )}

      {!loading &&
        !mapError &&
        profiles.length === 0 && (
          <div className="map-empty-chip">
            Nenhuma pessoa ativa neste raio. Tente aumentar a distância.
          </div>
        )}

      {selected && (
        <MapProfileCard
          profile={selected}
          onClose={() =>
            setSelected(
              null
            )
          }
        />
      )}
    </main>
  );
}
