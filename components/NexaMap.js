"use client";

import {
  useEffect,
  useRef,
  useState
} from "react";

import {
  MAP_INTENTION_COLORS
} from "@/lib/constants";

export default function NexaMap({
  profiles,
  myPosition,
  selectedId,
  onSelect
}) {
  const containerRef =
    useRef(null);

  const mapRef =
    useRef(null);

  const maplibreRef =
    useRef(null);

  const markersRef =
    useRef(
      new Map()
    );

  const meMarkerRef =
    useRef(null);

  const [
    mapReady,
    setMapReady
  ] = useState(false);

  useEffect(() => {
    let cancelled =
      false;

    async function init() {
      if (
        mapRef.current ||
        !containerRef.current
      ) {
        return;
      }

      const module =
        await import(
          "maplibre-gl"
        );

      if (cancelled)
        return;

      const maplibregl =
        module.default;

      maplibreRef.current =
        maplibregl;

      const initialCenter =
        myPosition
          ? [
              myPosition.lng,
              myPosition.lat
            ]
          : [
              -51.9253,
              -14.235
            ];

      const map =
        new maplibregl.Map({
          container:
            containerRef.current,

          style:
            "https://tiles.openfreemap.org/styles/bright",

          center:
            initialCenter,

          zoom:
            myPosition
              ? 13
              : 3.5,

          attributionControl:
            true
        });

      map.addControl(
        new maplibregl
          .NavigationControl({
            showCompass:
              false
          }),

        "top-right"
      );

      mapRef.current =
        map;

      map.once(
        "load",
        () => {
          if (cancelled)
            return;

          map.resize();
          setMapReady(true);
        }
      );
    }

    void init();

    return () => {
      cancelled =
        true;

      markersRef.current.forEach(
        (marker) => marker.remove()
      );
      markersRef.current.clear();

      meMarkerRef.current?.remove();
      meMarkerRef.current = null;

      mapRef.current?.remove();
      mapRef.current = null;
      maplibreRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (
      !myPosition ||
      !mapReady ||
      !mapRef.current ||
      !maplibreRef.current
    ) {
      return;
    }

    const map =
      mapRef.current;

    const maplibregl =
      maplibreRef.current;

    if (
      !meMarkerRef.current
    ) {
      const element =
        document
          .createElement(
            "div"
          );

      element.className =
        "nexa-me-marker";

      const dot =
        document
          .createElement(
            "div"
          );

      dot.className =
        "nexa-me-dot";

      element.appendChild(
        dot
      );

      meMarkerRef.current =
        new maplibregl.Marker({
          element
        })
          .setLngLat([
            myPosition.lng,
            myPosition.lat
          ])
          .addTo(
            map
          );

      map.easeTo({
        center: [
          myPosition.lng,
          myPosition.lat
        ],

        zoom:
          Math.max(
            map.getZoom(),
            12.5
          )
      });
    } else {
      meMarkerRef
        .current
        .setLngLat([
          myPosition.lng,
          myPosition.lat
        ]);
    }
  }, [
    myPosition,
    mapReady
  ]);

  useEffect(() => {
    const map =
      mapRef.current;

    const maplibregl =
      maplibreRef.current;

    if (
      !mapReady ||
      !map ||
      !maplibregl
    ) {
      return;
    }

    const activeIds =
      new Set(
        profiles.map(
          (profile) =>
            profile.user_id
        )
      );

    for (
      const [
        id,
        marker
      ]
      of markersRef
        .current
        .entries()
    ) {
      if (
        !activeIds.has(
          id
        )
      ) {
        marker.remove();

        markersRef
          .current
          .delete(
            id
          );
      }
    }

    profiles.forEach(
      (profile) => {
        const existing =
          markersRef
            .current
            .get(
              profile.user_id
            );

        if (existing) {
          existing
            .setLngLat([
              profile.public_lng,
              profile.public_lat
            ]);

          existing
            .getElement()
            .classList
            .toggle(
              "selected",
              profile.user_id ===
                selectedId
            );

          return;
        }

        const element =
          document
            .createElement(
              "button"
            );

        element.type =
          "button";

        element.className =
          profile.user_id ===
            selectedId
            ? "nexa-map-avatar selected"
            : "nexa-map-avatar";

        element.setAttribute(
          "aria-label",
          `Ver perfil de ${profile.name}`
        );

        element.style
          .setProperty(
            "--ring-color",

            MAP_INTENTION_COLORS[
              profile.current_intention
            ] ||
            "#D94B7D"
          );

        if (
          profile.avatar_url
        ) {
          const image =
            document
              .createElement(
                "img"
              );

          image.src =
            profile.avatar_url;

          image.alt =
            "";

          element.appendChild(
            image
          );
        } else {
          const initial =
            document
              .createElement(
                "span"
              );

          initial.textContent =
            profile.name
              ?.charAt(0)
              ?.toUpperCase()
            ||
            "?";

          element.appendChild(
            initial
          );
        }

        element.addEventListener(
          "click",
          () => {
            onSelect?.(
              profile
            );
          }
        );

        const marker =
          new maplibregl
            .Marker({
              element,
              anchor:
                "center"
            })
            .setLngLat([
              profile.public_lng,
              profile.public_lat
            ])
            .addTo(
              map
            );

        markersRef
          .current
          .set(
            profile.user_id,
            marker
          );
      }
    );

    if (
      myPosition &&
      profiles.length > 0
    ) {
      const bounds =
        new maplibregl.LngLatBounds();

      bounds.extend([
        myPosition.lng,
        myPosition.lat
      ]);

      profiles.forEach(
        (profile) => {
          bounds.extend([
            profile.public_lng,
            profile.public_lat
          ]);
        }
      );

      map.fitBounds(
        bounds,
        {
          padding: 90,
          maxZoom: 14,
          duration: 650
        }
      );
    }
  }, [
    profiles,
    onSelect,
    selectedId,
    myPosition,
    mapReady
  ]);

  return (
    <div
      ref={
        containerRef
      }
      className="nexa-map-container"
    />
  );
}
