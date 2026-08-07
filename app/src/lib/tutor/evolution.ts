/**
 * Que devient une compétence maîtrisée — sans conversation.
 *
 * Calque de `generation-referentiel.ts` : un prompt court, un outil, un
 * `envoyer` qui collecte. La différence est dans ce que le prompt porte — **ce
 * qui a été mesuré, et rien d'autre**.
 *
 * C'est le point délicat de ce chemin. Un modèle à qui l'on demande « que
 * devient cette compétence ? » a toutes les raisons d'inventer une progression
 * plausible : les successeurs pédagogiques sont un genre littéraire bien connu
 * de lui. Le prompt lui donne donc les valeurs observées — niveau, confiance,
 * robustesse, contextes réellement testés, nombre de preuves, ancienneté — et
 * lui interdit d'en ajouter (anti-hallucination §7).
 *
 * Les **intitulés voisins du domaine** partent aussi. Sans eux, le successeur
 * proposé redouble une compétence qui existe déjà à trois lignes de là. Le coût
 * est de quelques centaines de caractères : le plus gros domaine du compte
 * (logistique, 16 compétences vivantes) pèse 2 210 caractères d'intitulés.
 */

import type { Domaine, Skill, SkillState } from "@/lib/domain/types";
import type { Maitrise } from "@/lib/engine/maitrise";
import type { MoteurTuteur } from "./moteurs";
import { lireOutilsActifs, messageSansOutils } from "./moteurs";
import { outilEvolution, type PropositionEvolution } from "./outils";

export interface ResultatEvolution {
  evolution: PropositionEvolution | null;
  outilsActifs: boolean;
  erreur: string | null;
}

/**
 * Le prompt système de la proposition d'évolution.
 *
 * Il ne porte ni corpus, ni priorités, ni protocole d'évaluation : la question
 * posée est « où va cette compétence », pas « où en est la personne ».
 */
export function construirePromptEvolution(
  etat: SkillState,
  maitrise: Maitrise,
  voisines: Skill[],
  domaine: Domaine,
): string {
  const lignes: string[] = [
    "Tu es le tuteur du système pédagogique. Une compétence vient d'être reconnue comme maîtrisée. Tu proposes ce qu'elle devient.",
    "",
    "TU N'APPLIQUES RIEN.",
    "Ta proposition est soumise à la personne, qui arbitre. Rien n'est écrit sans son geste.",
    "",
    `COMPÉTENCE — ${etat.skill.code} · ${etat.skill.intitule}`,
    `Domaine : ${domaine.nom}. Palier actuel : ${etat.skill.palier}.`,
    "",
    "CE QUI A ÉTÉ MESURÉ",
    `- Niveau ${etat.niveau} sur 5.`,
    `- Confiance ${etat.confiance}.`,
    `- ${maitrise.explication.nombrePreuves} preuve(s) retenue(s).`,
    `- ${etat.contextesTestes.length} contexte(s) distinct(s) : ${
      etat.contextesTestes.length > 0 ? etat.contextesTestes.join(" · ") : "aucun"
    }.`,
  ];

  // Chaque valeur n'est écrite que si elle existe. Une ligne « robustesse : — »
  // inviterait le modèle à combler le trou.
  if (etat.robustesse !== null) lignes.push(`- Robustesse ${etat.robustesse}/100.`);
  if (etat.joursDepuisDernierePreuve !== null) {
    lignes.push(`- Dernière preuve il y a ${etat.joursDepuisDernierePreuve} jour(s).`);
  }
  if (etat.contradictions.length > 0) {
    lignes.push(`- ${etat.contradictions.length} preuve(s) contradictoire(s) conservée(s).`);
  }

  lignes.push(
    "",
    "COMPÉTENCES DÉJÀ PRÉSENTES DANS CE DOMAINE — ne redouble aucune d'elles",
    ...(voisines.length > 0
      ? voisines.map((s) => `- ${s.intitule} (${s.palier})`)
      : ["- aucune autre"]),
    "",
    "COMMENT CHOISIR",
    "- « successeur » quand la compétence est solide sur des contextes variés : propose ce qui vient après, au palier au-dessus, en t'appuyant sur elle.",
    "- « elargissement » quand la maîtrise tient sur des contextes trop proches les uns des autres : propose un contexte franchement différent où la remesurer.",
    "- « retrait » quand elle n'a plus sa place dans le périmètre de travail.",
    "",
    "N'affirme rien qui ne figure pas ci-dessus. Si les contextes testés sont peu nombreux ou se ressemblent, dis-le et propose un élargissement plutôt qu'un successeur.",
    "",
    "Appelle l'outil proposer_evolution UNE fois. Ne recopie pas le contenu de l'appel dans ta réponse.",
  );

  return lignes.join("\n");
}

/** Demande une évolution au moteur, sans conversation. */
export async function proposerEvolution(
  moteur: MoteurTuteur,
  etat: SkillState,
  maitrise: Maitrise,
  voisines: Skill[],
  domaine: Domaine,
  signal?: AbortSignal,
  diffuser?: (evenement: string, donnees: unknown) => void,
): Promise<ResultatEvolution> {
  let evolution: PropositionEvolution | null = null;
  let outilsActifs = true;

  const envoyer = (evenement: string, donnees: unknown) => {
    if (evenement !== "texte") diffuser?.(evenement, donnees);

    const actifs = lireOutilsActifs(evenement, donnees);
    if (actifs !== null) outilsActifs = actifs;

    if (evenement === "proposition") {
      const proposition = donnees as { genre: string; evolution?: PropositionEvolution };
      if (proposition.genre === "evolution" && proposition.evolution) {
        evolution = proposition.evolution;
      }
    }
  };

  await moteur.repondre({
    systemeStable: construirePromptEvolution(etat, maitrise, voisines, domaine),
    systemeProfil: "",
    outils: [outilEvolution()],
    messages: [
      {
        role: "user" as const,
        content: `Que devient ${etat.skill.code} — ${etat.skill.intitule} ?`,
      },
    ],
    signal,
    envoyer,
  });

  const erreur =
    evolution !== null
      ? null
      : outilsActifs
        ? "Le tuteur n'a proposé aucune évolution exploitable."
        : messageSansOutils("la proposition d'évolution");

  return { evolution, outilsActifs, erreur };
}
