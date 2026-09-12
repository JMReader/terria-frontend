"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FieldItem } from "@/data/fieldsData";
import {
  PassportMode,
  PassportSource,
  ShareState,
} from "@/types/passport";
import {
  findMockField,
  getField,
  getPublicField,
  publishField,
  unpublishField,
} from "@/lib/terriaApi";
import { useOwnerAuth } from "@/components/auth/OwnerAuthProvider";

interface UseParcelPassportArgs {
  id?: string;
  slug?: string;
  mode: PassportMode;
}

function shareStateOf(field: FieldItem): ShareState {
  const isPublished = field.status === "published" || !!field.publicSlug;
  return {
    status: isPublished ? "public" : "private",
    isPublished,
    publicSlug: field.publicSlug ?? null,
  };
}

/**
 * Resuelve la parcela del pasaporte:
 *  - mode owner → GET /v1/fields/{id} (la pertenencia la garantiza el gate/UX).
 *  - mode public → GET /v1/public/fields/{slug} sin auth.
 * Fallback: mock local (modo demo sin backend).
 */
export function useParcelPassport({ id, slug, mode }: UseParcelPassportArgs) {
  const { token } = useOwnerAuth();
  const [field, setField] = useState<FieldItem | null>(null);
  const [shareState, setShareState] = useState<ShareState>({
    status: "private",
    isPublished: false,
    publicSlug: null,
  });
  const [source, setSource] = useState<PassportSource>("loading");
  const requestRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestRef.current;
    queueMicrotask(() => {
      if (requestRef.current === requestId) setSource("loading");
    });

    const applyField = (f: FieldItem, src: PassportSource) => {
      if (requestRef.current !== requestId) return;
      setField(f);
      setShareState(shareStateOf(f));
      setSource(src);
    };

    const fail = (src: PassportSource) => {
      if (requestRef.current !== requestId) return;
      const mock = findMockField(id ?? slug ?? "");
      if (mock) {
        applyField(mock, "demo");
      } else {
        setField(null);
        setSource(src);
      }
    };

    if (mode === "public" && slug) {
      getPublicField(slug)
        .then((f) => applyField(f, "live"))
        .catch(() => fail("not-found"));
    } else if (mode === "owner" && id) {
      getField(id)
        .then((f) => applyField(f, "live"))
        .catch(() => fail("not-found"));
    } else {
      fail("not-found");
    }
  }, [id, slug, mode]);

  /** Publica si hace falta y copia la URL /p/{slug} al portapapeles. */
  const copyPublicLink = useCallback(async (): Promise<string | null> => {
    if (!field) return null;
    try {
      let currentSlug = shareState.publicSlug;
      if (!shareState.isPublished || !currentSlug) {
        setShareState((s) => ({ ...s, status: "pending" }));
        const res = await publishField(field.id, token);
        currentSlug = res.publicSlug;
        setShareState({ status: "public", isPublished: true, publicSlug: currentSlug });
      }
      const url = `${window.location.origin}/p/${currentSlug}`;
      await navigator.clipboard.writeText(url);
      return url;
    } catch {
      setShareState(shareStateOf(field));
      return null;
    }
  }, [field, shareState, token]);

  const unshare = useCallback(async () => {
    if (!field) return;
    try {
      setShareState((s) => ({ ...s, status: "pending" }));
      await unpublishField(field.id, token);
      setShareState({ status: "private", isPublished: false, publicSlug: null });
    } catch {
      setShareState(shareStateOf(field));
    }
  }, [field, token]);

  return { field, shareState, source, copyPublicLink, unshare };
}
