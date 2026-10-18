"use client";

import { useState } from "react";
import { MapPin, Search } from "lucide-react";

export default function PublicPlaceSearch({ value, onChange }) {
  const [query, setQuery] = useState(value?.name || "");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function search(event) {
    event.preventDefault();

    const cleanQuery = query.trim();
    if (cleanQuery.length < 3 || loading) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/places/search?q=${encodeURIComponent(cleanQuery)}`,
        { cache: "no-store" }
      );
      const data = await response.json();

      if (!response.ok) {
        setResults([]);
        setError(data.error || "Não conseguimos pesquisar os locais.");
      } else {
        setResults(data.places || []);

        if (!data.places?.length) {
          setError("Nenhum local público encontrado. Tente outro nome.");
        }
      }
    } catch {
      setResults([]);
      setError("Não conseguimos pesquisar os locais agora.");
    }

    setLoading(false);
  }

  function select(result) {
    onChange(result);
    setQuery(result.name);
    setResults([]);
    setError("");
  }

  return (
    <div className="place-search">
      <label className="input-label" htmlFor="public-place-search">
        Local público
      </label>

      <form className="place-search-input" onSubmit={search}>
        <Search size={18} />
        <input
          id="public-place-search"
          value={query}
          placeholder="Shopping, café, biblioteca..."
          onChange={(event) => {
            setQuery(event.target.value);
            setResults([]);
            setError("");
            onChange(null);
          }}
        />
        <button type="submit" disabled={loading || query.trim().length < 3}>
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </form>

      {error && <small className="place-search-error">{error}</small>}

      {results.length > 0 && (
        <div className="place-results">
          {results.map((result) => (
            <button
              key={result.placeId}
              type="button"
              onClick={() => select(result)}
            >
              <MapPin size={18} />
              <div>
                <strong>{result.name}</strong>
                <span>{result.address}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {value && (
        <div className="selected-place">
          <MapPin size={17} />
          <div>
            <strong>{value.name}</strong>
            <span>{value.address}</span>
          </div>
        </div>
      )}

      <small className="place-provider-credit">Dados © OpenStreetMap</small>
    </div>
  );
}
