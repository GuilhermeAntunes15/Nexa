"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE = 5 * 1024 * 1024;

export default function AvatarUploader({ userId, value, onChange }) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || !userId) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Use JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > MAX_SIZE) {
      setError("A imagem pode ter no máximo 5 MB.");
      return;
    }

    setUploading(true);
    setError("");

    const extension =
      file.name.split(".").pop()?.toLowerCase() ||
      (file.type === "image/png" ? "png" : "jpg");

    const path = `${userId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      });

    if (uploadError) {
      console.error(uploadError);
      setError("Não conseguimos enviar a foto.");
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    onChange?.(data.publicUrl);
    setUploading(false);
  }

  return (
    <div className="avatar-uploader">
      <button
        type="button"
        className="avatar-preview"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {value ? (
          <img src={value} alt="Sua foto de perfil" />
        ) : (
          <Camera size={34} />
        )}
      </button>

      <input
        ref={inputRef}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={upload}
      />

      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        <Upload size={17} />
        {uploading ? "Enviando..." : value ? "Trocar foto" : "Escolher foto"}
      </button>

      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
