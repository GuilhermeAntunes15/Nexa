"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function InterestPicker({ value = [], onChange, minimum = 3 }) {
  const supabase = useMemo(() => createClient(), []);
  const [interests, setInterests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("interests")
        .select("id,name,slug,icon")
        .order("name");

      if (!error) setInterests(data || []);
      setLoading(false);
    }

    load();
  }, [supabase]);

  function toggle(id) {
    if (value.includes(id)) {
      onChange(value.filter((item) => item !== id));
    } else {
      onChange([...value, id]);
    }
  }

  if (loading) {
    return <div className="picker-loading">Carregando interesses...</div>;
  }

  return (
    <div>
      <div className="interest-picker">
        {interests.map((interest) => {
          const selected = value.includes(interest.id);

          return (
            <button
              key={interest.id}
              type="button"
              className={selected ? "interest-chip selected" : "interest-chip"}
              onClick={() => toggle(interest.id)}
            >
              {selected && <Check size={14} />}
              {interest.icon && <span>{interest.icon}</span>}
              {interest.name}
            </button>
          );
        })}
      </div>

      <small className="field-hint">
        {value.length}/{minimum} mínimo
      </small>
    </div>
  );
}
