"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignedImage({ path, alt = "", className = "" }) {
  const supabase = useMemo(() => createClient(), []);
  const [url, setUrl] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      if (!path) return;
      const { data, error } = await supabase.storage.from("social-media").createSignedUrl(path,3600);
      if (active && !error) setUrl(data?.signedUrl || "");
    }
    load();
    return () => { active = false; };
  }, [path,supabase]);

  if (!url) return <div className={`${className} signed-image-placeholder`} />;
  return <img src={url} alt={alt} className={className} />;
}
