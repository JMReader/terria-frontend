import { FieldItem } from "@/data/fieldsData";

/** Modo en que se renderiza el pasaporte digital de parcela. */
export type PassportMode = "owner" | "public";

export type ShareStatus = "private" | "public" | "pending";

export interface ShareState {
  status: ShareStatus;
  isPublished: boolean;
  publicSlug: string | null;
}

export interface OwnerProfile {
  id: string;
  email: string;
  name: string | null;
  createdAt?: string;
}

export interface OwnerFieldRow extends FieldItem {
  shareState: ShareState;
}

/** Payload sanitizado que sirve GET /v1/public/fields/{slug}. */
export interface PublicParcelPayload extends FieldItem {
  publishedAt?: string;
}

export type PassportSource = "live" | "demo" | "loading" | "not-found" | "forbidden";
