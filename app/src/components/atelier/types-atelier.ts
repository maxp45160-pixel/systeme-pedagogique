import type { CategorieDocument } from "@/lib/documents/types-documents";
import type { LienMarkdown } from "@/lib/documents/markdown";
import type { ExerciseAttempt } from "@/lib/domain/types";
import type { VuePedagogiqueAtelier } from "@/lib/documents/vue-atelier";

export interface ElementAtelier {
  id: string;
  titre: string;
  type: string;
  typeLibelle: string;
  categorie: CategorieDocument;
  /** Porte la teinte de l'élément. Absent pour le transversal, qui reste discret. */
  domaineId?: string;
  dossier: string;
  /** Accès alternatifs vers la même fiche, sans dupliquer sa donnée. */
  dossiersSecondaires?: string[];
  contenuMd: string;
  contenuCharge: boolean;
  updatedAt?: string;
  schemaCompatible?: boolean;
  frontMatter: Record<string, string | number | boolean | null | string[]>;
  liens: LienMarkdown[];
  sortants: string[];
  entrants: string[];
  snapshots: Array<{ id: string; version: number; captureReason: string; capturedAt: string }>;
  tentatives: ExerciseAttempt[];
  source: "document" | "projection";
  lectureSeule: boolean;
  vuePedagogique?: VuePedagogiqueAtelier;
}