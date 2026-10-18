"use client";

import { useEffect, useRef } from "react";

export default function GuardianLiveMap({ latitude, longitude, place }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const initialDataRef = useRef({ latitude, longitude, place });

  useEffect(() => {
    let active = true;

    async function initialize() {
      if (!containerRef.current) return;

      const module = await import("maplibre-gl");
      if (!active) return;

      const maplibregl = module.default;
      const initialData = initialDataRef.current;
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: "https://tiles.openfreemap.org/styles/bright",
        center: [initialData.longitude, initialData.latitude],
        zoom: 15,
      });

      const userElement = document.createElement("div");
      userElement.className = "guardian-live-marker";

      markerRef.current = new maplibregl.Marker({ element: userElement })
        .setLngLat([initialData.longitude, initialData.latitude])
        .addTo(map);

      if (initialData.place?.lat && initialData.place?.lng) {
        const placeElement = document.createElement("div");
        placeElement.className = "guardian-place-marker";

        new maplibregl.Marker({ element: placeElement })
          .setLngLat([initialData.place.lng, initialData.place.lat])
          .addTo(map);
      }

      mapRef.current = map;
    }

    void initialize();

    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!markerRef.current) return;

    markerRef.current.setLngLat([longitude, latitude]);
    mapRef.current?.easeTo({
      center: [longitude, latitude],
      duration: 700,
    });
  }, [latitude, longitude]);

  return <div ref={containerRef} className="guardian-live-map" />;
}
