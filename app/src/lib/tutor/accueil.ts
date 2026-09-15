import type { OutilTuteur } from "./outils";
import { validerNouvelEngagement } from "@/lib/domain/engagement";

export const OUTIL_ACCUEIL = "traiter_accueil";
export type RetourAccueil = { action: "repondre" | "examen"; reponse: string; libelle: string; echeanceLe: string };

export const CONSIGNE_ACCUEIL = `Tu accueilles la personne dans Twiny. Réponds en français, brièvement et naturellement.
Ton seul pouvoir d'écriture est de déclarer un contrôle ou examen explicitement annoncé par la personne.
Utilise toujours traiter_accueil, exactement une fois. Ne produis pas de texte hors outil.
Pour une question, une hypothèse, un souhait, une négation, une correction ou un report : action repondre.
Ne crée jamais une échéance pour une demande de conseil ni à partir d'une de tes propres suggestions.
Pour un examen annoncé, exige une date absolue explicite avec jour, mois et année dans le dernier message utilisateur.
Si elle manque (vendredi, demain, date sans année...), demande la date complète. Si le sujet manque, demande-le.
Le libellé reprend un extrait exact des mots de la personne, éventuellement d'un précédent message.
Un contrôle sans compétence ou module connu est permis. Ne crée pas de lien, compétence, observation, séance ou plan.
Si la personne déclare une difficulté, reconnais-la sans l'assimiler à un niveau mesuré.
La personne peut joindre ses ressources dans la saisie de cette conversation puis choisir Analyser et ranger dans le fil. Ne l'envoie pas vers une autre interface de dépôt. Tu ne reçois pas le contenu de ces fichiers ni leurs comptes rendus : ne prétends pas les avoir lus, analysés ou classés. Un reçu de conservation n'est pas une analyse. Le panneau des ressources affiche les résultats enregistrés et les éléments encore à préciser. Le rangement crée les compétences sourcées dans les domaines existants. Pour corriger une ressource ou compléter un nouveau domaine, indique le bouton Corriger ou compléter de cette ressource : la demande se saisit ensuite ici. Sans ressource sélectionnée, cet outil ne modifie aucun rangement ; ne simule jamais sa modification.
Ne prétends jamais qu'une action a été effectuée : le serveur produit lui-même le reçu après écriture.
En dehors de la déclaration d'examen, aide à clarifier le besoin ou conseille ; les activités restent accessibles via Commencer à travailler.
Pour repondre, libelle et echeanceLe sont des chaînes vides. Les conversations ne sont pas une mémoire durable du système.`;

export function outilAccueil(): OutilTuteur {
  return { nom: OUTIL_ACCUEIL, description: "Comprendre l'échange ; proposer uniquement un examen explicitement déclaré, ou répondre sans écriture.", schema: {
    type: "object", properties: {
      action: { type: "string", enum: ["repondre", "examen"] },
      reponse: { type: "string" }, libelle: { type: "string" }, echeanceLe: { type: "string" },
    }, required: ["action", "reponse", "libelle", "echeanceLe"], additionalProperties: false,
  } };
}

export function validerRetourAccueil(x: Record<string, unknown>): RetourAccueil | null {
  if ((x.action !== "repondre" && x.action !== "examen") ||
    typeof x.reponse !== "string" || x.reponse.length > 2000 ||
    typeof x.libelle !== "string" || x.libelle.length > 160 || typeof x.echeanceLe !== "string") return null;
  if (x.action === "examen") {
    try { validerNouvelEngagement({ type: "examen", libelle: x.libelle, echeanceLe: x.echeanceLe }, new Set()); }
    catch { return null; }
  } else if (!x.reponse.trim() || x.libelle || x.echeanceLe) return null;
  return x as RetourAccueil;
}

// Contrôle de provenance, pas extraction linguistique : le modèle ne peut
// transformer une date relative ou une année supposée en date certaine.
export function dateExpliciteDans(texte: string, iso: string): boolean {
  const [annee, mois, jour] = iso.split("-").map(Number);
  const moisFrancais = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
  const normalise = texte.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const nom = moisFrancais[mois - 1]?.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  if (!nom) return false;
  return new RegExp(`(?<![\\d-])(?:${iso}|0?${jour}[/.]0?${mois}[/.]${annee}|0?${jour}(?:er)?\\s+${nom}\\s+${annee})(?!\\d)`).test(normalise);
}
