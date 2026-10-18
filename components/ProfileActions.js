"use client";

import {
  useEffect,
  useMemo,
  useState
} from "react";

import Link from "next/link";

import {
  Check,
  HeartHandshake,
  LoaderCircle,
  MessageCircle,
  UserCheck,
  UserPlus,
  X
} from "lucide-react";

import {
  createClient
} from "@/lib/supabase/client";

export default function ProfileActions({
  userId
}) {
  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );

  const [
    state,
    setState
  ] =
    useState(null);

  const [
    loading,
    setLoading
  ] =
    useState(true);

  const [
    actionLoading,
    setActionLoading
  ] =
    useState(false);

  const [
    feedback,
    setFeedback
  ] =
    useState("");

  useEffect(() => {
    loadState();
  }, [
    userId
  ]);

  async function loadState() {
    setLoading(true);

    const {
      data,
      error
    } =
      await supabase.rpc(
        "get_connection_state",
        {
          target_user:
            userId
        }
      );

    if (!error) {
      setState(
        data?.[0] ||
        null
      );
    }

    setLoading(false);
  }

  async function connect() {
    if (actionLoading)
      return;

    setActionLoading(true);

    setFeedback("");

    const {
      error
    } =
      await supabase.rpc(
        "request_connection",
        {
          target_user:
            userId,

          request_reason:
            "Perfil"
        }
      );

    if (error) {
      console.error(
        error
      );

      setFeedback(
        "Não conseguimos enviar a solicitação."
      );
    } else {
      setFeedback(
        "Solicitação enviada ✓"
      );

      await loadState();
    }

    setActionLoading(false);
  }

  async function accept() {
    if (
      !state?.request_id
    ) {
      return;
    }

    setActionLoading(true);

    const {
      data,
      error
    } =
      await supabase.rpc(
        "accept_connection_request",
        {
          request_id:
            state.request_id
        }
      );

    if (error) {
      console.error(
        error
      );

      setFeedback(
        "Não conseguimos aceitar a conexão."
      );
    } else {
      setFeedback(
        "Vocês se conectaram 💗"
      );

      setState({
        state:
          "connected",

        request_id:
          null,

        conversation_id:
          data
      });
    }

    setActionLoading(false);
  }

  async function decline() {
    if (
      !state?.request_id
    ) {
      return;
    }

    setActionLoading(true);

    const {
      error
    } =
      await supabase.rpc(
        "decline_connection_request",
        {
          request_id:
            state.request_id
        }
      );

    if (!error) {
      setState({
        state:
          "none",

        request_id:
          null,

        conversation_id:
          null
      });

      setFeedback(
        "Solicitação recusada."
      );
    }

    setActionLoading(false);
  }

  async function cancel() {
    if (
      !state?.request_id
    ) {
      return;
    }

    setActionLoading(true);

    const {
      error
    } =
      await supabase.rpc(
        "cancel_connection_request",
        {
          target_request:
            state.request_id
        }
      );

    if (!error) {
      setState({
        state:
          "none",

        request_id:
          null,

        conversation_id:
          null
      });

      setFeedback(
        "Solicitação cancelada."
      );
    }

    setActionLoading(false);
  }

  if (loading) {
    return (
      <div className="profile-actions-loading">
        <LoaderCircle size={18} />

        Carregando...
      </div>
    );
  }

  if (
    state?.state ===
    "self"
  ) {
    return null;
  }

  return (
    <section className="public-profile-actions">
      {state?.state ===
        "none" && (
        <button
          className="btn btn-primary"
          type="button"
          disabled={
            actionLoading
          }
          onClick={
            connect
          }
        >
          <UserPlus size={18} />

          Conectar
        </button>
      )}

      {state?.state ===
        "outgoing_pending" && (
        <button
          className="btn btn-secondary"
          type="button"
          disabled={
            actionLoading
          }
          onClick={
            cancel
          }
        >
          <Check size={18} />

          Solicitação enviada
        </button>
      )}

      {state?.state ===
        "incoming_pending" && (
        <>
          <button
            className="btn btn-primary"
            type="button"
            disabled={
              actionLoading
            }
            onClick={
              accept
            }
          >
            <UserCheck size={18} />

            Aceitar
          </button>

          <button
            className="btn btn-secondary"
            type="button"
            disabled={
              actionLoading
            }
            onClick={
              decline
            }
          >
            <X size={18} />

            Recusar
          </button>
        </>
      )}

      {state?.state ===
        "connected" && (
        <>
          {state.conversation_id && (
            <Link
              href={
                `/app/conversas/${state.conversation_id}`
              }
              className="btn btn-primary"
            >
              <MessageCircle size={18} />

              Mensagem
            </Link>
          )}

          <Link
            href={
              `/app/criar?invite=${userId}`
            }
            className="btn btn-secondary"
          >
            Convidar
          </Link>

          <Link
            href={
              `/app/sos?target=${userId}`
            }
            className="btn btn-secondary"
          >
            <HeartHandshake size={18} />

            Pedir ajuda
          </Link>
        </>
      )}

      {feedback && (
        <div className="profile-action-feedback">
          {feedback}
        </div>
      )}
    </section>
  );
}
