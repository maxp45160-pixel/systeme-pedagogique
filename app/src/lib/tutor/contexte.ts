/**
 * Construction du contexte pédagogique envoyé au tuteur.
 *
 * Point important : la fonction renvoie aussi le MANIFESTE de ce qui a été
 * réellement inclus. L'interface affiche ce manifeste tel quel, pour ne jamais
 * laisser croire que l'IA « se souvient » de plus qu'elle n'a reçu
 * (cahier des charges : ne pas afficher de fausses informations sur la mémoire
 * de l'IA).
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { Contexte } from "@/lib/store/context";
import { DOMAINES } from "@/lib/domain/referentiel";
import { AUTONOMIE } from "@/lib/domain/types";
import { formatDateCourte } from "@/lib/engine/dates";

const RACINE_DATA = path.join(process.cwd(), "data");

/** Fichiers de protocole, dans l'ordre où ils sont empilés. */
const PROTOCOLES = [
  { fichier: "00_instructions/00_SYSTEME_INSTRUCTIONS_PRINCIPALES.txt", nom: "Instructions principales" },
  { fichier: "00_instructions/00_SYSTEME_PROTOCOLE_EVALUATION.txt", nom: "Protocole d'évaluation" },
  {
    fichier: "00_instructions/00_SYSTEME_PROTOCOLE_ANTI_HALLUCINATION.txt",
    nom: "Protocole anti-hallucination",
  },
];

export interface SectionContexte {
  nom: string;
  caracteres: number;
  origine: "fichier" | "calcule";
}

export interface ContextePedagogique {
  /** Bloc stable : protocoles. Mis en cache par l'API. */
  systemeStable: string;
  /** Bloc variable : profil courant dérivé des preuves. */
  systemeProfil: string;
  manifeste: SectionContexte[];
  /** Estimation grossière, annoncée comme telle dans l'interface. */
  caracteresTotal: number;
}

async function lireFichier(relatif: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(RACINE_DATA, relatif), "utf8");
  } catch {
    return null;
  }
}

/**
 * Sérialise l'état des compétences pour le tuteur.
 *
 * Chaque ligne porte le niveau, la confiance, la robustesse et le nombre de
 * preuves — de sorte que le tuteur puisse raisonner sur la fiabilité de
 * l'évaluation et non seulement sur le niveau affiché.
 */
function serialiserProfil(ctx: Contexte): string {
  const lignes: string[] = [];

  lignes.push("# ÉTAT COURANT DU PROFIL (calculé à partir du journal de preuves)");
  lignes.push("");
  lignes.push(`Date : ${formatDateCourte(ctx.now.toISOString())}`);
  lignes.push(
    `Progression globale : ${
      ctx.global.scoreGlobal === null ? "non calculable (aucune preuve)" : `${ctx.global.scoreGlobal}/100`
    } · confiance ${ctx.global.confiance}`,
  );
  lignes.push(
    `Couverture : ${ctx.global.competencesEvaluees}/${ctx.global.competencesTotal} compétences évaluées · ${ctx.global.nombrePreuves} preuve(s) directe(s)`,
  );
  lignes.push(`Niveau global (gamification, secondaire) : ${ctx.xp.palier.niveau} — ${ctx.xp.palier.nom}`);
  lignes.push("");

  for (const domaine of DOMAINES) {
    const etats = ctx.etats.filter((e) => e.skill.domaine === domaine.id);
    lignes.push(`## ${domaine.nom.toUpperCase()}`);
    for (const e of etats) {
      if (e.preuves.length === 0) {
        const hyp = e.skill.hypotheseInitiale
          ? " (hypothèse BUT QLIO non vérifiée — preuve de niveau D)"
          : "";
        lignes.push(`${e.skill.code} | NON ÉVALUÉ${hyp} | ${e.skill.intitule}`);
        continue;
      }
      lignes.push(
        `${e.skill.code} | niveau ${e.niveau}/5 | score ${e.score?.toFixed(1)}/5 | confiance ${
          e.confiance
        } | robustesse ${e.robustesse?.toFixed(2)} | ${e.preuves.length} preuve(s) sur ${
          e.contextesTestes.length
        } contexte(s) | dernière il y a ${e.joursDepuisDernierePreuve} j | ${e.skill.intitule}`,
      );
      if (e.contradictions.length > 0) {
        lignes.push(
          `      ⚠ ${e.contradictions.length} preuve(s) contradictoire(s) conservée(s) — confiance réduite, niveau maintenu`,
        );
      }
    }
    lignes.push("");
  }

  return lignes.join("\n");
}

function serialiserErreurs(ctx: Contexte): string {
  const actives = ctx.donnees.errors.filter((e) => !e.archivee);
  if (actives.length === 0) {
    return "# ERREURS RÉCURRENTES\n\nAucune erreur récurrente enregistrée à ce jour.";
  }
  const lignes = ["# ERREURS RÉCURRENTES", ""];
  for (const e of actives) {
    const contextes = new Set(e.occurrences.map((o) => o.contexte));
    lignes.push(
      `- [${e.statut}] ${e.concept} (${e.skillCodes.join(", ")}) · ${e.occurrences.length} occurrence(s) sur ${contextes.size} contexte(s)`,
    );
    lignes.push(`  Erreur : ${e.description}`);
    lignes.push(`  Cause probable : ${e.causeProbable}`);
    lignes.push(`  Correction attendue : ${e.correction}`);
  }
  return lignes.join("\n");
}

function serialiserRecent(ctx: Contexte): string {
  const recentes = [...ctx.donnees.evidence]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);
  if (recentes.length === 0) {
    return "# TRAVAIL RÉCENT\n\nAucune séance enregistrée.";
  }
  const lignes = ["# TRAVAIL RÉCENT (12 dernières preuves)", ""];
  for (const p of recentes) {
    lignes.push(
      `- ${formatDateCourte(p.date)} · ${p.skillCode} · ${p.type} · ${p.resultat} · ${p.autonomie} (${
        AUTONOMIE[p.autonomie].libelle
      }) · qualité ${p.qualite} · contexte « ${p.contexte} »${
        p.commentaire ? ` · ${p.commentaire}` : ""
      }`,
    );
  }
  return lignes.join("\n");
}

function serialiserRecommandations(ctx: Contexte): string {
  const lignes = ["# PRIORITÉS CALCULÉES PAR LE SYSTÈME", ""];
  lignes.push(
    "Ces priorités proviennent du moteur de recommandation (protocole d'évaluation §16). Tu peux les discuter, pas les inventer.",
  );
  lignes.push("");
  for (const r of ctx.recommandations.slice(0, 5)) {
    lignes.push(
      `${r.etat.skill.code} (valeur ${Math.round(r.valeur)}) — ${r.etat.skill.intitule}\n    ${r.raison}`,
    );
  }
  return lignes.join("\n");
}

/** Consignes propres à l'usage dans cette application. */
const CONSIGNES_INTERFACE = `# CADRE D'INTERVENTION DANS CETTE INTERFACE

Tu interviens depuis l'application de suivi. Trois règles s'ajoutent aux protocoles ci-dessus :

1. TU NE PEUX PAS ÉCRIRE DANS LE PROFIL.
   Tu ne disposes d'aucun accès en écriture. Si une interaction constitue une
   preuve de compétence, ne dis jamais « j'ai mis à jour ton profil ». Propose
   la mise à jour dans un bloc structuré, que l'utilisateur validera lui-même :

   PROPOSITION DE MISE À JOUR
   Compétence : <code>
   Niveau actuel : <valeur lue dans le profil ci-dessous>
   Niveau proposé : <valeur>
   Preuve : <ce qui a été observé dans cet échange, précisément>
   Autonomie observée : <A0-A4>
   Qualité de la preuve : <faible|moyenne|forte>
   Réserve : <ce qui reste à confirmer>

2. TU NE DISPOSES QUE DU CONTEXTE FOURNI CI-DESSOUS.
   Tu n'as aucune mémoire des échanges précédents en dehors de la conversation
   en cours et de l'état du profil transmis. Ne prétends pas te souvenir d'une
   séance qui n'apparaît pas dans le travail récent.

3. RESTE CONCIS SAUF DEMANDE CONTRAIRE.
   L'utilisateur vient travailler, pas lire des synthèses. Pas d'introduction,
   pas de récapitulatif du profil non demandé, pas de félicitations
   automatiques. Réponds à la demande, questionne, corrige, propose la suite.`;

export async function construireContexte(ctx: Contexte): Promise<ContextePedagogique> {
  const manifeste: SectionContexte[] = [];
  const blocsStables: string[] = [];

  for (const p of PROTOCOLES) {
    const contenu = await lireFichier(p.fichier);
    if (contenu) {
      blocsStables.push(contenu);
      manifeste.push({ nom: p.nom, caracteres: contenu.length, origine: "fichier" });
    }
  }

  blocsStables.push(CONSIGNES_INTERFACE);
  manifeste.push({
    nom: "Cadre d'intervention dans l'interface",
    caracteres: CONSIGNES_INTERFACE.length,
    origine: "calcule",
  });

  const profil = serialiserProfil(ctx);
  const erreurs = serialiserErreurs(ctx);
  const recent = serialiserRecent(ctx);
  const priorites = serialiserRecommandations(ctx);

  manifeste.push(
    { nom: "État courant des 39 compétences", caracteres: profil.length, origine: "calcule" },
    { nom: "Erreurs récurrentes", caracteres: erreurs.length, origine: "calcule" },
    { nom: "Travail récent", caracteres: recent.length, origine: "calcule" },
    { nom: "Priorités calculées", caracteres: priorites.length, origine: "calcule" },
  );

  const systemeStable = blocsStables.join("\n\n---\n\n");
  const systemeProfil = [profil, erreurs, recent, priorites].join("\n\n---\n\n");

  return {
    systemeStable,
    systemeProfil,
    manifeste,
    caracteresTotal: systemeStable.length + systemeProfil.length,
  };
}

/** Version texte intégrale, pour le mode « copier le contexte » sans clé API. */
export function contexteEnTexte(c: ContextePedagogique, question: string): string {
  return [
    c.systemeStable,
    "\n\n---\n\n",
    c.systemeProfil,
    "\n\n---\n\n# DEMANDE\n\n",
    question,
  ].join("");
}
