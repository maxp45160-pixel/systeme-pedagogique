/**
 * Migration unique du référentiel codé en dur vers les tables par compte
 * (ADR-026). Émet du SQL sur la sortie standard ; **ne se connecte à rien**.
 *
 *   cd app && npx tsx scripts/migrer-referentiel.ts > supabase/migration-referentiel.sql
 *
 * Le fichier produit se relit à la main puis s'applique dans Supabase Studio,
 * comme tout changement de schéma (ADR-012 : pas de CLI de migration).
 *
 * Ce que la migration décide, et pourquoi :
 *
 * - **maxime** (26 preuves sur 22 codes, 7 domaines) reçoit les 53 compétences
 *   et les 8 domaines. `active` reprend exactement `SKILLS_ACTIFS`, c'est-à-dire
 *   les 10 compétences du domaine pilote d'ADR-020 : l'état du produit ne change
 *   pas, seul son lieu de stockage change.
 *
 * - **cyril** (3 preuves : DEV-01, DEV-02, STAT-01) ne reçoit QUE ces trois
 *   compétences et leurs deux domaines, en `archive = true`. Son historique
 *   reste lisible et la clé étrangère `evidence_competence_fk` est satisfaite,
 *   mais son référentiel de travail est vide : il choisit son propre thème par
 *   l'amorçage. Lui recopier un référentiel écrit pour quelqu'un d'autre était
 *   précisément le défaut que ce chantier corrige.
 *
 * - **clement** (aucune preuve) ne reçoit rien.
 *
 * Les identifiants de compte sont écrits en clair et vérifiés au début du SQL :
 * une migration qui viserait le mauvais compte serait indétectable après coup.
 */

import { DOMAINES, SKILLS, CODES_ACTIFS } from "../src/lib/domain/referentiel";

/** Comptes existants au 31/07/2026, relevés dans `public.profiles`. */
const MAXIME = "d4210770-e9ed-44d8-be57-36d2151f896a";
const CYRIL = "5a6b80a4-6421-48ba-a254-ee4220c34ccb";

/** Les seuls codes que porte une preuve du compte de cyril. */
const CODES_CYRIL = ["DEV-01", "DEV-02", "STAT-01"];

function txt(valeur: string): string {
  return `'${valeur.replace(/'/g, "''")}'`;
}

function tableauTexte(valeurs: string[]): string {
  return valeurs.length === 0
    ? "ARRAY[]::TEXT[]"
    : `ARRAY[${valeurs.map(txt).join(", ")}]::TEXT[]`;
}

function ligneDomaine(userId: string, id: string, ordre: number, archive: boolean): string {
  const d = DOMAINES.find((x) => x.id === id);
  if (!d) throw new Error(`Domaine inconnu : ${id}`);
  return `  (${txt(userId)}, ${txt(d.id)}, ${txt(d.nom)}, ${txt(d.prefixe)}, ${txt(
    d.description,
  )}, ${ordre}, ${archive}, 'migration')`;
}

function ligneCompetence(
  userId: string,
  code: string,
  ordre: number,
  active: boolean,
  archive: boolean,
): string {
  const s = SKILLS.find((x) => x.code === code);
  if (!s) throw new Error(`Compétence inconnue : ${code}`);
  // Les `hypotheseInitiale` du référentiel historique se justifient par le BUT
  // QLIO du compte qui l'utilisait. Les recopier ailleurs attribuerait à
  // quelqu'un d'autre un diplôme qui n'est pas le sien — ce qui a été fait par
  // erreur le 31/07/2026 sur le compte tiers, puis corrigé (ADR-029).
  //
  // Une hypothèse n'est transférable qu'au compte dont elle décrit la formation.
  const hypothese =
    s.hypotheseInitiale && userId === MAXIME
      ? `${txt(JSON.stringify(s.hypotheseInitiale))}::jsonb`
      : "NULL";
  return `  (${txt(userId)}, ${txt(s.code)}, ${txt(s.domaine)}, ${txt(s.intitule)}, ${txt(
    s.palier,
  )}, ${tableauTexte(s.prerequis)}, ${s.importance}, ${ordre}, ${active}, ${archive}, ${hypothese}, 'migration')`;
}

const COLONNES_DOMAINES =
  "user_id, id, nom, prefixe, description, ordre, archive, origine";
const COLONNES_COMPETENCES =
  "user_id, code, domaine, intitule, palier, prerequis, importance, ordre, active, archive, hypothese_initiale, origine";

const lignes: string[] = [];

lignes.push(`-- ====================================================================
-- Migration du référentiel codé en dur vers les tables par compte (ADR-026).
--
-- GÉNÉRÉ par \`scripts/migrer-referentiel.ts\` — ne pas éditer à la main :
-- régénérer. Idempotent (ON CONFLICT DO NOTHING), applicable plusieurs fois.
--
-- Prérequis : la section 2 de \`schema.sql\` doit avoir été appliquée.
-- Ensuite : réexécuter \`schema.sql\`, qui posera alors evidence_competence_fk.
-- ====================================================================

-- Refus net si les comptes visés n'existent pas : mieux vaut une erreur qu'une
-- migration silencieusement vide.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = ${txt(MAXIME)}) THEN
    RAISE EXCEPTION 'Compte ${MAXIME} introuvable — vérifier les identifiants avant d''appliquer.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = ${txt(CYRIL)}) THEN
    RAISE EXCEPTION 'Compte ${CYRIL} introuvable — vérifier les identifiants avant d''appliquer.';
  END IF;
END;
$$;
`);

/* ---- maxime : le référentiel complet ---- */

lignes.push(`-- --------------------------------------------------------------------
-- maxime.peyredieu — les 8 domaines et les 53 compétences.
-- \`active\` reprend le domaine pilote d'ADR-020 : 10 compétences DEV.
-- --------------------------------------------------------------------

INSERT INTO public.domaines (${COLONNES_DOMAINES}) VALUES`);
lignes.push(
  DOMAINES.map((d, i) => ligneDomaine(MAXIME, d.id, i, false)).join(",\n") +
    "\nON CONFLICT (user_id, id) DO NOTHING;\n",
);

// L'ordre dans le domaine reprend l'ordre de déclaration du fichier source :
// c'est lui qui départage les compétences d'un même palier, à la place de la
// liste `ORDRE_DIAGNOSTIC` supprimée.
const rangDansDomaine = new Map<string, number>();
lignes.push(`INSERT INTO public.competences (${COLONNES_COMPETENCES}) VALUES`);
lignes.push(
  SKILLS.map((s) => {
    const ordre = rangDansDomaine.get(s.domaine) ?? 0;
    rangDansDomaine.set(s.domaine, ordre + 1);
    return ligneCompetence(MAXIME, s.code, ordre, CODES_ACTIFS.has(s.code), false);
  }).join(",\n") + "\nON CONFLICT (user_id, code) DO NOTHING;\n",
);

/* ---- cyril : le strict nécessaire, archivé ---- */

const domainesCyril = [...new Set(CODES_CYRIL.map((c) => SKILLS.find((s) => s.code === c)!.domaine))];

lignes.push(`-- --------------------------------------------------------------------
-- cyril.hup2716 — uniquement les compétences que ses 3 preuves référencent,
-- archivées. Son référentiel de travail reste vide : il passe par l'amorçage
-- et déclare son propre thème.
-- --------------------------------------------------------------------

INSERT INTO public.domaines (${COLONNES_DOMAINES}) VALUES`);
lignes.push(
  domainesCyril.map((id, i) => ligneDomaine(CYRIL, id, i, true)).join(",\n") +
    "\nON CONFLICT (user_id, id) DO NOTHING;\n",
);

lignes.push(`INSERT INTO public.competences (${COLONNES_COMPETENCES}) VALUES`);
lignes.push(
  CODES_CYRIL.map((code, i) => ligneCompetence(CYRIL, code, i, false, true)).join(",\n") +
    "\nON CONFLICT (user_id, code) DO NOTHING;\n",
);

/* ---- contrôle final ---- */

lignes.push(`-- --------------------------------------------------------------------
-- Contrôle : aucune preuve ne doit rester sans compétence correspondante.
-- Tant que ce SELECT ne renvoie pas 0, evidence_competence_fk ne se posera pas.
-- --------------------------------------------------------------------

SELECT COUNT(*) AS preuves_orphelines
FROM public.evidence e
LEFT JOIN public.competences c
  ON c.user_id = e.user_id AND c.code = e.skill_code
WHERE c.code IS NULL;`);

process.stdout.write(lignes.join("\n") + "\n");
