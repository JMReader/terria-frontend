"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FieldItem, FIELDS_DATA } from "@/data/fieldsData";
import {
  OwnerFieldRow,
  PassportSource,
  ShareState,
} from "@/types/passport";
import {
  fetchOwnerFields,
  publishField,
  unpublishField,
} from "@/lib/terriaApi";
import { useOwnerAuth } from "@/components/auth/OwnerAuthProvider";

function shareStateOf(field: FieldItem): ShareState {
  const isPublished = field.status === "published" || !!field.publicSlug;
  return {
    status: isPublished ? "public" : "private",
    isPublished,
    publicSlug: field.publicSlug ?? null,
  };
}

function toRow(field: FieldItem): OwnerFieldRow {
  return { ...field, shareState: shareStateOf(field) };
}

/**
 * Parcelas del dueño autenticado (GET /v1/me/fields) + acciones de
 * compartición. Fallback demo: FIELDS_DATA como si fueran propias.
 */
export function useOwnerFields() {
  const { token, status: authStatus } = useOwnerAuth();
  const [fields, setFields] = useState<OwnerFieldRow[]>([]);
  const [source, setSource] = useState<PassportSource>("loading");
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestRef.current;
    if (!token) {
      if (authStatus === "anonymous") {
        setFields([]);
        setSource("demo");
      }
      return;
    }
    try {
      const rows = await fetchOwnerFields(token);
      if (requestRef.current !== requestId) return;
      setFields(rows.map(toRow));
      setSource("live");
    } catch {
      if (requestRef.current !== requestId) return;
      setFields(FIELDS_DATA.map(toRow));
      setSource("demo");
    }
  }, [token, authStatus]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
  }, [refresh]);

  const patchShare = useCallback((id: string, shareState: ShareState) => {
    setFields((prev) =>
      prev.map((f) =>
        f.id === id
          ? {
              ...f,
              shareState,
              publicSlug: shareState.publicSlug ?? undefined,
              status: shareState.isPublished ? "published" : f.status,
            }
          : f
      )
    );
  }, []);

  /** Publica si hace falta y copia la URL /p/{slug} al portapapeles. */
  const copyPublicLink = useCallback(
    async (field: OwnerFieldRow): Promise<string | null> => {
      try {
        let slug = field.shareState.publicSlug;
        if (!field.shareState.isPublished || !slug) {
          patchShare(field.id, { status: "pending", isPublished: false, publicSlug: null });
          const res = await publishField(field.id, token);
          slug = res.publicSlug;
          patchShare(field.id, { status: "public", isPublished: true, publicSlug: slug });
        }
        const url = `${window.location.origin}/p/${slug}`;
        await navigator.clipboard.writeText(url);
        return url;
      } catch {
        patchShare(field.id, shareStateOf(field));
        return null;
      }
    },
    [token, patchShare]
  );

  const unshare = useCallback(
    async (field: OwnerFieldRow) => {
      try {
        patchShare(field.id, { status: "pending", isPublished: true, publicSlug: field.shareState.publicSlug });
        await unpublishField(field.id, token);
        patchShare(field.id, { status: "private", isPublished: false, publicSlug: null });
      } catch {
        patchShare(field.id, shareStateOf(field));
      }
    },
    [token, patchShare]
  );

  return { fields, source, refresh, copyPublicLink, unshare };
}
