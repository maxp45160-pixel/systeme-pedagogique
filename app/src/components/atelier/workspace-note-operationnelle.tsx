"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CoquilleWorkspace } from "@/components/seances/coquille-workspace";
import { ConcepteurSeance, type DonneesSeance } from "@/components/seances/concepteur-seance";
import { BarreProgression, BandeauInfo, Bouton } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { analyserDocumentMarkdown } from "@/lib/documents/markdown";
import { definitionTypeDocument } from "@/lib/documents/types-documents";
import {
  lireValeursSections,
  mettreAJourSections,
  type ValeursSections,
} from "@/lib/documents/sections-markdown";
import {
  analyserJournal,
  ligneCompetenceSeance,
  ligneExerciceSeance,
} from "@/lib/documents/journal-seance";
import { sauvegarderDocumentAction } from "@/lib/store/document-actions";

export interface WorkspaceNoteOperationnelleProps {
  /** Identifiant canonique de la fiche, repris dans l'URL de l'Atelier. */
  id: string;
  /** Corps Markdown chargé par la page serveur avant d'ouvrir le workspace. */
  contenuInitial: string;
  /** Version connue au chargement, utilisée par le contrôle optimiste. */
  updatedAtInitial?: string;
  /**
   * Présent pour la seule branche `seance` : de quoi composer.
   *
   * La composition n'est pas réécrite ici — c'est `ConcepteurSeance`, avec son
   * moteur d'assemblage et sa validation, qui la mène. La note lui sert
   * d'entrée et recueille ses liens.
   */
  donneesSeance?: DonneesSeance;
}

/** Section où la note inscrit ce que la composition a retenu. */
const SECTION_LIENS = "Déroulé";

/**
 * Une section de journal : ce que le travail a inscrit, en lecture.
 *
 * Chaque exercice mène à son parcours — c'est l'action utile depuis une séance.
 * Chaque compétence mène à sa fiche dans l'Atelier. Les lignes écrites à la
 * main, elles, restent du texte : on ne fabrique pas un lien vers une cible
 * qu'on n'a pas reconnue.
 */
function Journal({ corps }: { corps: string }) {
  const lignes = analyserJournal(corps);

  if (lignes.length === 0) {
    return (
      <p className="text-sm text-texte-discret">
        Rien encore. Ce que tu composes s’inscrit ici.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5 text-sm">
      {lignes.map((ligne, index) => (
        <li key={`${ligne.texte}-${index}`} className="flex items-baseline gap-2">
          {ligne.genre === "exercice" && ligne.cible ? (
            <>
              <span className="text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                Exercice
              </span>
              <Link
                href={`/exercices/${encodeURIComponent(ligne.cible)}`}
                className="font-medium text-primaire hover:underline"
              >
                {ligne.libelle}
              </Link>
            </>
          ) : ligne.genre === "competence" && ligne.cible ? (
            <>
              <span className="text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                Compétence
              </span>
              <Link
                href={`/atelier?document=${encodeURIComponent(ligne.cible)}`}
                className="text-primaire hover:underline"
              >
                {ligne.cible}
              </Link>
            </>
          ) : (
            <span className="text-texte-attenue">{ligne.texte}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function BarreEtapes({ renseignees, total }: { renseignees: number; total: number }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[0.6875rem] text-texte-attenue">
        <span>Sections renseignées</span>
        <span className="chiffres font-medium">{renseignees} / {total}</span>
      </div>
      <BarreProgression
        fraction={total > 0 ? renseignees / total : 0}
        libelle={`${renseignees} section${renseignees > 1 ? "s" : ""} renseignée${renseignees > 1 ? "s" : ""} sur ${total}`}
      />
    </div>
  );
}

/**
 * Espace de travail d'une note opérationnelle.
 *
 * Le rôle de cette surface est éditorial : elle prépare une production dans
 * les sections déclarées par le registre. Elle ne fabrique ni mesure, ni
 * score, ni preuve ; ces observations restent sur le parcours d'évaluation.
 */
export function WorkspaceNoteOperationnelle({
  id,
  contenuInitial,
  updatedAtInitial,
  donneesSeance,
}: WorkspaceNoteOperationnelleProps) {
  const analyseInitiale = useMemo(
    () => analyserDocumentMarkdown(id, contenuInitial),
    [id, contenuInitial],
  );
  const definition = analyseInitiale.type ? definitionTypeDocument(analyseInitiale.type) : null;
  const sections = definition?.sections ?? [];
  const sectionsJournal = new Set(definition?.sectionsJournal ?? []);
  /** Ce que la personne peut saisir : tout sauf ce qui s'écrit tout seul. */
  const sectionsSaisies = sections.filter((section) => !sectionsJournal.has(section));
  const [contenu, setContenu] = useState(contenuInitial);
  const [updatedAt, setUpdatedAt] = useState(updatedAtInitial);
  const [valeurs, setValeurs] = useState<ValeursSections>(() =>
    lireValeursSections(contenuInitial, sections),
  );
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  /*
   * La progression ne compte que ce qui dépend de la personne. Inclure une
   * section de journal la ferait avancer toute seule : l'indicateur dirait
   * « tu as avancé » là où le système a seulement inscrit ce qu'il savait déjà.
   */
  const renseignees = sectionsSaisies.filter((section) => valeurs[section]?.trim()).length;
  const noteOperationnelle = definition?.categorie === "action" && analyseInitiale.frontMatter.role === "operationnel";
  const domaineDeclare = analyseInitiale.frontMatter.domaine;
  const domaineInitial =
    typeof domaineDeclare === "string" && domaineDeclare !== "transversal"
      ? domaineDeclare
      : undefined;
  const contexteInitial =
    typeof analyseInitiale.frontMatter.contexte === "string"
      ? analyseInitiale.frontMatter.contexte
      : undefined;
  const themeIdDeclare = analyseInitiale.frontMatter.theme_id;
  const themeInitial =
    typeof themeIdDeclare === "string"
      ? donneesSeance?.themes.find((theme) => theme.id === themeIdDeclare)
      : undefined;
  const domaineLibelle = domaineInitial
    ? donneesSeance?.domaines.find((domaine) => domaine.id === domaineInitial)?.nom
    : undefined;

  async function enregistrer() {
    if (enregistrement || !noteOperationnelle) return;
    setEnregistrement(true);
    setMessage(null);
    setErreur(null);
    const contenuSuivant = mettreAJourSections(contenu, sections, valeurs);

    if (contenuSuivant === contenu) {
      setMessage("Aucune modification à enregistrer.");
      setEnregistrement(false);
      return;
    }

    try {
      const resultat = await sauvegarderDocumentAction(id, contenuSuivant, false, updatedAt);
      setContenu(contenuSuivant);
      if (resultat) setUpdatedAt(resultat.updatedAt);
      setMessage("Fiche enregistrée.");
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "La fiche n’a pas pu être enregistrée.");
    } finally {
      setEnregistrement(false);
    }
  }

  /**
   * Inscrit ce que la composition a retenu, sans rien effacer.
   *
   * Les liens sont **ajoutés** au bas de la section, jamais substitués : ce que
   * l'utilisateur a écrit avant de composer lui appartient. Un lien déjà
   * présent n'est pas réécrit, pour qu'une seconde composition n'empile pas les
   * doublons.
   *
   * La séance est déjà écrite quand on arrive ici. Si l'enregistrement de la
   * fiche échoue, on le dit — on ne fait pas croire que la séance a échoué.
   */
  async function inscrireSeance(seance: {
    activites: { type: string; ref: string; libelle: string }[];
    codesVises: string[];
  }) {
    const existant = valeurs[SECTION_LIENS] ?? "";
    const lignes = [
      ...seance.activites
        .filter((activite) => activite.type === "exercice")
        .map((activite) => ligneExerciceSeance(activite.ref, activite.libelle)),
      ...seance.codesVises.map(ligneCompetenceSeance),
    ].filter((ligne) => !existant.includes(ligne));
    if (lignes.length === 0) return;

    const valeursSuivantes = {
      ...valeurs,
      [SECTION_LIENS]: [existant.trim(), ...lignes].filter(Boolean).join("\n"),
    };
    const contenuSuivant = mettreAJourSections(contenu, sections, valeursSuivantes);
    try {
      const resultat = await sauvegarderDocumentAction(id, contenuSuivant, false, updatedAt);
      setValeurs(valeursSuivantes);
      setContenu(contenuSuivant);
      if (resultat) setUpdatedAt(resultat.updatedAt);
    } catch {
      setErreur(
        "La séance a bien été créée, mais les liens n’ont pas pu être inscrits dans la fiche.",
      );
    }
  }

  const titre = analyseInitiale.titre || "Note opérationnelle";
  const surtitre = definition ? `Fiche de travail · ${definition.libelle}` : "Fiche de travail";

  return (
    <CoquilleWorkspace
      surtitre={surtitre}
      titre={titre}
      sortie={{ href: "/atelier", libelle: "Retourner à l’Atelier" }}
      barre={<BarreEtapes renseignees={renseignees} total={sectionsSaisies.length} />}
    >
      {!noteOperationnelle ? (
        <div className="mx-auto max-w-3xl">
          <BandeauInfo ton="danger">
            <p>Cette fiche n’est pas une note opérationnelle éditable.</p>
          </BandeauInfo>
        </div>
      ) : (
        <form
          className="mx-auto max-w-4xl space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void enregistrer();
          }}
        >
          <div className="rounded-lg border border-primaire/20 bg-primaire-faible/35 px-4 py-3 text-sm leading-relaxed text-texte-attenue">
            {donneesSeance
              ? `Cette page est le carnet de ta séance${themeInitial ? ` sur « ${themeInitial.libelle} »` : domaineLibelle ? ` dans « ${domaineLibelle} »` : ""}. La composition ci-dessous choisira les exercices dans ce périmètre, puis le déroulé se mettra à jour tout seul.`
              : "Cette fiche cadre une production. Décris ton travail dans chaque section ; elle ne devient une preuve qu’après une évaluation validée."}
          </div>

          {donneesSeance && (
            <ConcepteurSeance
              {...donneesSeance}
              domaineInitial={domaineInitial}
              contexteInitial={contexteInitial}
              themeInitial={themeInitial}
              libelle="Reprendre la composition"
              ouvertParDefaut
              surSeanceCreee={inscrireSeance}
            />
          )}

          <div className="space-y-4">
            {sections.map((section, index) => (
              <section key={section} className="rounded-lg border border-bordure bg-surface p-4 shadow-[var(--ombre-posee)]">
                <div className="mb-3 flex items-baseline gap-2">
                  <span className="chiffres text-[0.6875rem] text-texte-discret">{index + 1}</span>
                  <h2 className="font-serif text-lg font-medium">{section}</h2>
                  {sectionsJournal.has(section) && (
                    <span className="text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                      s’écrit tout seul
                    </span>
                  )}
                </div>
                {sectionsJournal.has(section) ? (
                  <Journal corps={valeurs[section] ?? ""} />
                ) : (
                  <Champ
                    id={`note-${id}-${index}`}
                    label={`Contenu — ${section}`}
                    multiligne
                    rows={6}
                    value={valeurs[section] ?? ""}
                    onChange={(event) => {
                      const valeur = event.target.value;
                      setValeurs((anciennes) => ({ ...anciennes, [section]: valeur }));
                      setMessage(null);
                    }}
                    disabled={enregistrement}
                    className="min-h-32 resize-y leading-relaxed"
                  />
                )}
              </section>
            ))}
          </div>

          {erreur && (
            <BandeauInfo ton="danger" taille="compacte">
              <p>{erreur}</p>
            </BandeauInfo>
          )}
          {message && !erreur && (
            <p className="text-xs text-succes" role="status">{message}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bordure pt-4">
            <p className="text-xs text-texte-discret">
              {renseignees} section{renseignees > 1 ? "s" : ""} renseignée{renseignees > 1 ? "s" : ""} sur {sectionsSaisies.length}
            </p>
            <Bouton type="submit" variante="principal" enChargement={enregistrement}>
              Enregistrer la fiche
            </Bouton>
          </div>
        </form>
      )}
    </CoquilleWorkspace>
  );
}
