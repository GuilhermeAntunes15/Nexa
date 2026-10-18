"use client";

import {
  useMemo,
  useRef,
  useState
} from "react";
import {
  ImagePlus,
  Mic,
  Plus,
  Send,
  Square,
  X
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ChatComposer({
  conversationId,
  userId,
  reply,
  onClearReply
}) {
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");

  async function sendText(event) {
    event.preventDefault();
    if (!text.trim() || sending) return;

    setSending(true);
    setError("");

    const { error: sendError } = await supabase.rpc("send_message", {
      target_conversation: conversationId,
      p_type: "text",
      p_content: text.trim(),
      p_media_path: null,
      p_reply_to: reply?.id || null
    });

    if (sendError) {
      console.error(sendError);
      setError("Não conseguimos enviar.");
    } else {
      setText("");
      onClearReply?.();
    }

    setSending(false);
  }

  async function uploadImage(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Use JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("A imagem é muito grande.");
      return;
    }

    setSending(true);

    const extension = file.name.split(".").pop() || "jpg";
    const path = `${conversationId}/${userId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(path, file, { cacheControl: "3600" });

    if (uploadError) {
      console.error(uploadError);
      setError("Não conseguimos enviar a imagem.");
      setSending(false);
      return;
    }

    const { error: messageError } = await supabase.rpc("send_message", {
      target_conversation: conversationId,
      p_type: "image",
      p_content: null,
      p_media_path: path,
      p_reply_to: reply?.id || null
    });

    if (messageError) {
      console.error(messageError);
      setError("Não conseguimos enviar a imagem.");
    } else {
      onClearReply?.();
    }

    setSending(false);
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Gravação de áudio não está disponível neste navegador.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm"
        });
        await uploadAudio(blob);
      };

      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (caughtError) {
      console.error(caughtError);
      setError("Não conseguimos acessar o microfone.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  async function uploadAudio(blob) {
    setSending(true);
    const path = `${conversationId}/${userId}/${crypto.randomUUID()}.webm`;

    const { error: uploadError } = await supabase.storage
      .from("chat-media")
      .upload(path, blob, {
        contentType: blob.type || "audio/webm"
      });

    if (uploadError) {
      console.error(uploadError);
      setError("Não conseguimos enviar o áudio.");
      setSending(false);
      return;
    }

    const { error: sendError } = await supabase.rpc("send_message", {
      target_conversation: conversationId,
      p_type: "audio",
      p_content: null,
      p_media_path: path,
      p_reply_to: reply?.id || null
    });

    if (sendError) {
      console.error(sendError);
      setError("Não conseguimos enviar o áudio.");
    } else {
      onClearReply?.();
    }

    setSending(false);
  }

  return (
    <div className="chat-composer-wrapper">
      {reply && (
        <div className="composer-reply">
          <div>
            <strong>Respondendo a {reply.sender_name}</strong>
            <span>{reply.content || "Mídia"}</span>
          </div>
          <button type="button" onClick={onClearReply}>
            <X size={17} />
          </button>
        </div>
      )}

      {error && <div className="chat-composer-error">{error}</div>}

      <form className="chat-composer" onSubmit={sendText}>
        <button type="button" className="composer-action" aria-label="Mais opções">
          <Plus size={21} />
        </button>

        <button
          type="button"
          className="composer-action"
          onClick={() => fileRef.current?.click()}
          aria-label="Enviar imagem"
        >
          <ImagePlus size={21} />
        </button>

        <input
          ref={fileRef}
          hidden
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={uploadImage}
        />

        <input
          className="composer-input"
          value={text}
          placeholder="Mensagem..."
          onChange={(event) => setText(event.target.value)}
        />

        {text.trim() ? (
          <button
            type="submit"
            className="composer-send"
            disabled={sending}
            aria-label="Enviar"
          >
            <Send size={20} />
          </button>
        ) : recording ? (
          <button
            type="button"
            className="composer-recording"
            onClick={stopRecording}
            aria-label="Parar gravação"
          >
            <Square size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="composer-action"
            onClick={startRecording}
            aria-label="Gravar áudio"
          >
            <Mic size={21} />
          </button>
        )}
      </form>
    </div>
  );
}
