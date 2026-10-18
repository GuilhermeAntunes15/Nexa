"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import {
  createClient
} from "@/lib/supabase/client";

export default function useRequestCount() {
  const supabase =
    useMemo(
      () =>
        createClient(),
      []
    );

  const [
    count,
    setCount
  ] =
    useState(0);

  const load =
    useCallback(
      async () => {
        const {
          data
        } =
          await supabase.rpc(
            "get_my_connection_requests"
          );

        setCount(
          data?.length ||
          0
        );
      },
      [
        supabase
      ]
    );

  useEffect(() => {
    load();

    const channel =
      supabase
        .channel(
          "request-count"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "connection_requests"
          },
          load
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    supabase,
    load
  ]);

  return count;
}
