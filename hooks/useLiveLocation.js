"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  createClient
} from "@/lib/supabase/client";

function distanceMeters(
  first,
  second
) {
  if (
    !first ||
    !second
  ) {
    return Infinity;
  }

  const earthRadius =
    6371000;

  const toRadians =
    (value) =>
      value *
      Math.PI /
      180;

  const lat1 =
    toRadians(
      first.lat
    );

  const lat2 =
    toRadians(
      second.lat
    );

  const deltaLat =
    toRadians(
      second.lat -
      first.lat
    );

  const deltaLng =
    toRadians(
      second.lng -
      first.lng
    );

  const a =
    Math.sin(
      deltaLat / 2
    ) ** 2
    +
    Math.cos(lat1)
    *
    Math.cos(lat2)
    *
    Math.sin(
      deltaLng / 2
    ) ** 2;

  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return (
    earthRadius *
    c
  );
}

export default function useLiveLocation() {
  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );

  const watchId =
    useRef(null);

  const lastServerSend =
    useRef(0);

  const lastServerPosition =
    useRef(null);

  const [
    position,
    setPosition
  ] = useState(null);

  const [
    accuracy,
    setAccuracy
  ] = useState(null);

  const [
    status,
    setStatus
  ] = useState("idle");

  const [
    error,
    setError
  ] = useState("");

  const [
    lastSyncAt,
    setLastSyncAt
  ] = useState(null);

  const sendToServer =
    useCallback(
      async (
        nextPosition,
        gpsAccuracy
      ) => {
        const now =
          Date.now();

        const elapsed =
          now -
          lastServerSend.current;

        const moved =
          distanceMeters(
            lastServerPosition.current,
            nextPosition
          );

        if (
          elapsed < 15000
          &&
          moved < 120
        ) {
          return;
        }

        lastServerSend.current =
          now;

        const {
          error:
            locationError
        } =
          await supabase.rpc(
            "set_my_location",
            {
              lat:
                nextPosition.lat,

              lng:
                nextPosition.lng,

              gps_accuracy:
                gpsAccuracy
            }
          );

        if (
          locationError
        ) {
          setStatus(
            "error"
          );

          setError(
            locationError.message ||
            "Não conseguimos sincronizar sua localização."
          );

          return;
        }

        lastServerPosition.current =
          nextPosition;

        setLastSyncAt(
          Date.now()
        );
      },
      [
        supabase
      ]
    );

  const start =
    useCallback(
      () => {
        if (
          !navigator.geolocation
        ) {
          setStatus(
            "unsupported"
          );

          setError(
            "Este dispositivo não oferece localização pelo navegador."
          );

          return;
        }

        if (
          watchId.current !== null
        ) {
          return;
        }

        setError("");
        setStatus(
          "requesting"
        );

        watchId.current =
          navigator
            .geolocation
            .watchPosition(
              async (
                gps
              ) => {
                const next = {
                  lat:
                    gps.coords.latitude,

                  lng:
                    gps.coords.longitude
                };

                setPosition(
                  next
                );

                setAccuracy(
                  gps.coords.accuracy
                );

                setStatus(
                  "active"
                );

                await sendToServer(
                  next,
                  gps.coords.accuracy
                );
              },

              (
                gpsError
              ) => {
                if (
                  gpsError.code === 1
                ) {
                  setStatus(
                    "denied"
                  );

                  setError(
                    "A localização está desativada."
                  );
                } else {
                  setStatus(
                    "error"
                  );

                  setError(
                    "Não conseguimos atualizar sua localização."
                  );
                }
              },

              {
                enableHighAccuracy:
                  true,

                timeout:
                  15000,

                maximumAge:
                  10000
              }
            );
      },
      [
        sendToServer
      ]
    );

  const stop =
    useCallback(
      async () => {
        if (
          watchId.current !== null
        ) {
          navigator
            .geolocation
            .clearWatch(
              watchId.current
            );

          watchId.current =
            null;
        }

        await supabase.rpc(
          "set_presence",
          {
            new_status:
              "offline"
          }
        );

        setStatus(
          "idle"
        );
      },
      [
        supabase
      ]
    );

  useEffect(() => {
    async function handleVisibility() {
      if (
        document.visibilityState ===
        "hidden"
      ) {
        await supabase.rpc(
          "set_presence",
          {
            new_status:
              "away"
          }
        );
      } else if (
        status === "active"
      ) {
        await supabase.rpc(
          "set_presence",
          {
            new_status:
              "online"
          }
        );
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [
    supabase,
    status
  ]);

  useEffect(() => {
    return () => {
      if (
        watchId.current !== null
      ) {
        navigator
          .geolocation
          .clearWatch(
            watchId.current
          );
      }
    };
  }, []);

  return {
    position,
    accuracy,
    status,
    error,
    lastSyncAt,
    start,
    stop
  };
}
