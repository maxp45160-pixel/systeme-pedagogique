"use client";

/**
 * L'espace de travail d'un projet.
 *
 * ## Ce qu'il remplace
 *
 * `WorkspaceNoteOperationnelle` traitait un projet comme n'importe quelle note
 * opérationnelle : une pile de sections, dont les trois auto-écrites étaient
 * rendues en **texte brut**. On lisait donc `**Compétences visées**`,
 * `[[LOG-01]]` et `- ` littéralement, et le sujet d'un projet — six
 * compétences, cinq jalons, deux critères par compétence — s'affichait comme un
 * fichier de configuration. Le contenu était juste ; sa présentation le rendait
 * illisible.
 *
 * ## Ce qu'il fait
 *
 * Il lit la fiche comme une structure (`analyserFicheProjet`) et rend chaque
 * pièce pour ce qu'elle est : le brief en prose, les compétences en pastilles
 * qui mènent à leur fiche, les jalons en étapes qu'on coche, les critères en
 * cartes. Les deux sections à remplir restent des champs.
 *
 * ## Ce qu'il ne fait pas
 *
 * **Cocher un jalon ne mesure rien** (P5, ADR-064). C'est une déclaration
 * d'avancement, écrite dans le front-matter de la fiche ; aucune preuve,
 * aucun niveau, aucun score n'en découle. La barre de progression compte des
 * étapes déclarées, et le dit.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { CoquilleWorkspace, sortieWorkspace } from "@/components/atelier/coquille-workspace";
import { BandeauInfo, BarreProgression, Bouton, Carte, cx } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { Markdown } from "@/components/ui/markdown";
import { analyserDocumentMarkdown } from "@/lib/documents/markdown";
import { definitionTypeDocument } from "@/lib/documents/types-documents";
import {
  analyserFicheProjet,
  ecrireJalonsFaits,
  lireJalonsFaits,
} from "@/lib/documents/projet";
import {
  lireValeursSections,
  mettreAJourSections,
  type ValeursSections,
} from "@/lib/documents/sections-markdown";
import { sauvegarderDocumentAction } from "@/lib/store/document-actions";

export interface WorkspaceProjetProps {
  id: string;
  contenuInitial: string;
  updatedAtInitial?: string;
  retour?: string;
}

const LIBELLE_VISEE: Record<string, string> = {
  application: "Mettre en œuvre",
  transfert: "Transférer à un contexte nouveau",
  integration: "Intégrer plusieurs compétences",
};

export function WorkspaceProjet({ id, contenuInitial, updatedAtInitial, retour }: WorkspaceProjetProps) {
  const [contenu, setContenu] = useState(contenuInitial);
  const [updatedAt, setUpdatedAt] = useState(updatedAtInitial);
  const [enregistrement, setEnregistrement] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const analyse = useMemo(() => analyserDocumentMarkdown(id, contenu), [id, contenu]);
  const definition = analyse.type ? definitionTypeDocument(analyse.type) : null;
  const sections = useMemo(() => definition?.sections ?? [], [definition]);
  const sectionsJournal = useMemo(
    () => new Set(definition?.sectionsJournal ?? []),
    [definition],
  );
  const sectionsSaisies = sections.filter((section) => !sectionsJournal.has(section));

  const [valeurs, setValeurs] = useState<ValeursSections>(() =>
    lireValeursSections(contenuInitial, definitionTypeDocument("projet")?.sections ?? []),
  );

  const fiche = useMemo(() => analyserFicheProjet(valeurs), [valeurs]);
  const faits = useMemo(() => lireJalonsFaits(analyse.frontMatter), [analyse.frontMatter]);

  const visee = typeof analyse.frontMatter.projet_visee === "string"
    ? analyse.frontMatter.projet_visee
    : undefined;

  const renseignees = sectionsSaisies.filter((section) => valeurs[section]?.trim()).length;

  /**
   * Coche ou décoche une étape, et l'écrit tout de suite.
   *
   * Écrire à la volée plutôt qu'attendre « Enregistrer » : une case cochée qui
   * disparaît au rechargement ferait douter de tout le reste. Un échec est dit,
   * et l'état affiché revient à celui du document — on ne laisse pas une case
   * cochée qui n'existe que dans l'écran.
   */
  async function basculerJalon(numero: number) {
    const suivants = new Set(faits);
    if (suivants.has(numero)) suivants.delete(numero);
    else suivants.add(numero);

    const contenuSuivant = ecrireJalonsFaits(contenu, suivants);
    const precedent = contenu;
    setContenu(contenuSuivant);
    setErreur(null);
    try {
      const resultat = await sauvegarderDocumentAction(id, contenuSuivant, false, updatedAt);
      if (resultat) setUpdatedAt(resultat.updatedAt);
    } catch (cause) {
      setContenu(precedent);
      setErreur(
        cause instanceof Error ? cause.message : "L'avancement n'a pas pu être enregistré.",
      );
    }
  }

  async function enregistrer() {
    if (enregistrement) return;
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
      setMessage("Projet enregistré.");
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Le projet n'a pas pu être enregistré.");
    } finally {
      setEnregistrement(false);
    }
  }

  const totalJalons = fiche.jalons.length;
  const cochés = fiche.jalons.filter((_, index) => faits.has(index + 1)).length;

  return (
    <CoquilleWorkspace
      surtitre="Projet"
      titre={analyse.titre || "Projet"}
      sortie={sortieWorkspace(retour)}
      barre={
        totalJalons > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-[0.6875rem] text-texte-attenue">
              <span>Étapes déclarées faites</span>
              <span className="chiffres font-medium">
                {cochés} / {totalJalons}
              </span>
            </div>
            <BarreProgression
              fraction={cochés / totalJalons}
              libelle={`${cochés} étape(s) déclarée(s) faite(s) sur ${totalJalons}`}
            />
          </div>
        ) : undefined
      }
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {erreur && (
          <BandeauInfo ton="danger" taille="compacte">
            <p>{erreur}</p>
          </BandeauInfo>
        )}

        {/* Le cadre du projet, d'un coup d'œil. */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {fiche.dureeMin !== undefined && (
            <span className="rounded-full border border-bordure bg-surface-2 px-2.5 py-1">
              <span className="chiffres font-medium">{fiche.dureeMin}</span> min
              {fiche.segmentMin !== undefined && (
                <span className="text-texte-discret">
                  {" "}· segments de {fiche.segmentMin} min
                </span>
              )}
            </span>
          )}
          {visee && (
            <span className="rounded-full border border-bordure bg-surface-2 px-2.5 py-1">
              {LIBELLE_VISEE[visee] ?? visee}
            </span>
          )}
          {fiche.competences.length > 0 && (
            <span className="rounded-full border border-bordure bg-surface-2 px-2.5 py-1">
              <span className="chiffres font-medium">{fiche.competences.length}</span> compétence
              {fiche.competences.length > 1 ? "s" : ""} visée
              {fiche.competences.length > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* ---- Le sujet ------------------------------------------------- */}
        {fiche.brief && (
          <Carte>
            <div className="px-5 py-4">
              <h2 className="font-serif text-lg font-medium">Le sujet</h2>
              <div className="mt-2 text-sm leading-relaxed text-texte-attenue">
                <Markdown contenu={fiche.brief} />
              </div>
            </div>
          </Carte>
        )}

        {/* ---- Les compétences ------------------------------------------ */}
        {fiche.competences.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-serif text-lg font-medium">Ce que ce projet fait travailler</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {fiche.competences.map((competence) => (
                <li key={competence.code}>
                  <Link
                    href={`/atelier?document=${encodeURIComponent(competence.code)}`}
                    className="block h-full rounded-lg border border-bordure bg-surface-2/60 px-3 py-2.5 transition-colors hover:border-primaire/40 hover:bg-primaire-faible/25"
                  >
                    <span className="font-mono text-[0.6875rem] text-primaire">
                      {competence.code}
                    </span>
                    <span className="mt-0.5 block text-sm leading-snug">{competence.intitule}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---- Les étapes ------------------------------------------------ */}
        {fiche.jalons.length > 0 && (
          <section className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-lg font-medium">Les étapes</h2>
              <p className="text-[0.6875rem] text-texte-discret">
                Cocher une étape déclare qu&apos;elle est faite — aucune preuve n&apos;en découle.
              </p>
            </div>
            <ol className="space-y-2">
              {fiche.jalons.map((jalon, index) => {
                const numero = index + 1;
                const fait = faits.has(numero);
                return (
                  <li key={`${jalon.titre}-${index}`}>
                    <div
                      className={cx(
                        "flex gap-3 rounded-lg border px-3 py-3 transition-colors",
                        fait
                          ? "border-succes/35 bg-succes-faible/25"
                          : "border-bordure bg-surface",
                      )}
                    >
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={fait}
                          onChange={() => void basculerJalon(numero)}
                          className="mt-1 size-4 shrink-0 cursor-pointer"
                          aria-label={`Étape ${numero} : ${jalon.titre}`}
                        />
                        <span className="min-w-0">
                          <span className="flex flex-wrap items-baseline gap-2">
                            <span className="chiffres text-[0.6875rem] text-texte-discret">
                              {numero}
                            </span>
                            <span
                              className={cx(
                                "text-sm font-medium",
                                fait && "text-texte-attenue line-through",
                              )}
                            >
                              {jalon.titre}
                            </span>
                          </span>
                          <span className="mt-1 block text-sm text-texte-attenue">
                            {jalon.consigne}
                          </span>
                          {jalon.attendu && (
                            <span className="mt-1 block text-xs text-texte-discret">
                              Attendu : {jalon.attendu}
                            </span>
                          )}
                        </span>
                      </label>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {/* ---- Ce qu'on attend du rendu ---------------------------------- */}
        {fiche.sectionsRendu.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-serif text-lg font-medium">Ce que le rendu doit contenir</h2>
            <ul className="space-y-1.5">
              {fiche.sectionsRendu.map((section, index) => (
                <li
                  key={`${section.section}-${index}`}
                  className="rounded-lg border border-bordure px-3 py-2 text-sm"
                >
                  <span className="font-medium">{section.section}</span>
                  <span className="text-texte-attenue"> — {section.consigne}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---- Les critères ---------------------------------------------- */}
        {fiche.criteres.length > 0 && (
          <section className="space-y-2">
            <h2 className="font-serif text-lg font-medium">Les critères, connus d&apos;avance</h2>
            <ul className="space-y-1.5">
              {fiche.criteres.map((critere, index) => (
                <li
                  key={`${critere.code}-${index}`}
                  className="flex flex-wrap items-baseline gap-2 rounded-lg border border-bordure px-3 py-2 text-sm"
                >
                  <span className="font-mono text-[0.6875rem] text-primaire">{critere.code}</span>
                  <span className="min-w-0 flex-1 text-texte-attenue">{critere.label}</span>
                </li>
              ))}
            </ul>
            {fiche.notes.map((note, index) => (
              <p key={index} className="text-[0.6875rem] text-texte-discret">
                {note}
              </p>
            ))}
          </section>
        )}

        {/* ---- Ce qu'on écrit soi-même ----------------------------------- */}
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void enregistrer();
          }}
        >
          {sectionsSaisies.map((section, index) => (
            <section
              key={section}
              className="rounded-lg border border-bordure bg-surface p-4 shadow-[var(--ombre-posee)]"
            >
              <h2 className="mb-3 font-serif text-lg font-medium">{section}</h2>
              <Champ
                id={`projet-${id}-${index}`}
                label={`Contenu — ${section}`}
                multiligne
                rows={8}
                value={valeurs[section] ?? ""}
                onChange={(event) => {
                  const valeur = event.target.value;
                  setValeurs((anciennes) => ({ ...anciennes, [section]: valeur }));
                  setMessage(null);
                }}
                disabled={enregistrement}
                className="resize-y leading-relaxed"
              />
            </section>
          ))}

          {message && !erreur && (
            <p className="text-xs text-succes" role="status">
              {message}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bordure pt-4">
            <p className="text-xs text-texte-discret">
              {renseignees} section{renseignees > 1 ? "s" : ""} renseignée
              {renseignees > 1 ? "s" : ""} sur {sectionsSaisies.length}. Ce travail ne devient une
              preuve qu&apos;après une évaluation validée.
            </p>
            <Bouton type="submit" variante="principal" enChargement={enregistrement}>
              Enregistrer le projet
            </Bouton>
          </div>
        </form>
      </div>
    </CoquilleWorkspace>
  );
}
