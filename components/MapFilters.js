"use client";

import {
  SlidersHorizontal
} from "lucide-react";

export default function MapFilters({
  filters,
  onChange
}) {
  function update(
    key,
    value
  ) {
    onChange({
      ...filters,
      [key]: value
    });
  }

  return (
    <div className="map-filters">
      <div className="map-filter-title">
        <SlidersHorizontal
          size={17}
        />

        Explorar
      </div>

      <select
        value={
          filters.radius
        }
        onChange={
          (event) =>
            update(
              "radius",
              Number(
                event.target.value
              )
            )
        }
      >
        <option value={3}>
          Até 3 km
        </option>

        <option value={5}>
          Até 5 km
        </option>

        <option value={10}>
          Até 10 km
        </option>

        <option value={20}>
          Até 20 km
        </option>

        <option value={30}>
          Até 30 km
        </option>
      </select>

      <select
        value={
          filters.intention
        }
        onChange={
          (event) =>
            update(
              "intention",
              event.target.value
            )
        }
      >
        <option value="">
          Todas as intenções
        </option>

        <option value="friendship">
          Amizade
        </option>

        <option value="talk">
          Conversar
        </option>

        <option value="study">
          Estudar
        </option>

        <option value="coffee">
          Café
        </option>

        <option value="event">
          Evento
        </option>

        <option value="sport">
          Esporte
        </option>

        <option value="help">
          Posso ajudar
        </option>
      </select>

      <label className="map-verified-filter">
        <input
          type="checkbox"
          checked={
            filters.verified
          }
          onChange={
            (event) =>
              update(
                "verified",
                event.target.checked
              )
          }
        />

        Verificadas
      </label>
    </div>
  );
}
