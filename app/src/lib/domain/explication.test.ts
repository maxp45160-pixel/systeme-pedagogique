import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ATTRIBUTION_RESULTAT_EXPLICATION,
  CRITERES_AUTO_EXPLICATION,
  SEUIL_REUSSITE_COMPREHENSION,
  verifierTexteExplication,
  EXPLICATION_MIN_CARACTERES,
  EXPLICATION_MAX_CARACTERES,
} from "./explication";

/**
 * Ce que fige ce fichier : la transcription du protocole §10.1 ne dérive pas.
 *
 * Le barème de l'auto-explication décide d'un `resultat` et de deux scores de
 * dimension qui entrent au journal comme n'importe quelle Observation. C'est
 * donc une règle de mesure, et le protocole d'évaluation fait foi
 * (`INSTRUCTIONS §3`). La route `/api/explication/evaluer` ne charge pas
 * `00_instructions/` — son prompt est délibérément court — donc le code
 * **transcrit** le protocole au lieu de l'injecter.
 *
 * Une transcription sans garde-fou est une seconde vérité en sursis : le seuil
 * a vécu en dur dans `lib/tutor/explication.ts`, hors de tout protocole, du
 * jour où l'écran a été construit jusqu'au 24/08/2026. Ce test relit le fichier
 * de protocole et vérifie que les deux disent le même chiffre.
 */

const DOSSIER = join(__dirname, "../../../data/00_instructions");

/** Le principe — toujours chargé, parce que le chat en a besoin pour lire. */
const CORE = join(DOSSIER, "00_SYSTEME_PROTOCOLE_EVALUATION_CORE.txt");

/**
 * Le barème — chargé avec le mode SYNTHÉTIQUE seulement.
 *
 * Le chat n'évalue jamais une auto-explication : c'est `/api/explication/evaluer`
 * qui le fait, et cette route ne charge aucun protocole. Faire voyager quatre
 * critères dans chaque message du chat les payait sans jamais les employer
 * (ADR-125).
 */
const SYNTHESE = join(DOSSIER, "00_SYSTEME_PROTOCOLE_EVALUATION_SYNTHESE.txt");

describe("le barème de l'auto-explication", () => {
  it("dit le même seuil que le protocole d'évaluation §10.1", () => {
    expect(readFileSync(CORE, "utf8")).toContain("10.1 L'AUTO-EXPLICATION");
    expect(readFileSync(SYNTHESE, "utf8")).toContain(
      `compréhension >= ${SEUIL_REUSSITE_COMPREHENSION}`,
    );
  });

  it("porte les quatre critères et les trois résultats", () => {
    expect(CRITERES_AUTO_EXPLICATION).toHaveLength(4);
    expect(ATTRIBUTION_RESULTAT_EXPLICATION).toHaveLength(3);
  });

  it("expose le seuil dans la règle d'attribution, sans le recopier", () => {
    /*
     * La règle est composée à partir de la constante : changer le seuil change
     * la phrase envoyée au modèle, sans qu'on ait à y penser. C'est ce qui
     * empêche le prompt et le code de diverger — l'autre moitié du garde-fou,
     * la première étant l'accord avec le protocole ci-dessus.
     */
    expect(ATTRIBUTION_RESULTAT_EXPLICATION[0]).toContain(
      String(SEUIL_REUSSITE_COMPREHENSION),
    );
  });
});

describe("les bornes d'une explication", () => {
  it("refuse plus court que le minimum", () => {
    expect(verifierTexteExplication("trop court").valide).toBe(false);
  });

  it("accepte un texte entre les deux bornes", () => {
    expect(verifierTexteExplication("a".repeat(EXPLICATION_MIN_CARACTERES)).valide).toBe(true);
  });

  it("refuse plus long que le maximum", () => {
    expect(verifierTexteExplication("a".repeat(EXPLICATION_MAX_CARACTERES + 1)).valide).toBe(false);
  });
});
