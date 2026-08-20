"use client";

import { useMemo, useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import { CoquilleWorkspace, sortieWorkspace } from "@/components/atelier/coquille-workspace";
import { ConcepteurSeance, type DonneesSeance } from "@/components/seances/concepteur-seance";
import { BandeauInfo, BarreProgression, Bouton, Carte, cx } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { Markdown } from "@/components/ui/markdown";
import { analyserDocumentMarkdown } from "@/lib/documents/markdown";
import { definitionTypeDocument, type PieceJointeDocument } from "@/lib/documents/types-documents";
import {
  lireValeursSections,
  mettreAJourSections,
  type ValeursSections,
} from "@/lib/documents/sections-markdown";
import {
  analyserFicheProjet,
  ecrireJalonsFaits,
  lireJalonsFaits,
} from "@/lib/documents/projet";
import {
  analyserJournal,
  ligneCompetenceSeance,
  ligneExerciceSeance,
} from "@/lib/documents/journal-seance";
import { erreurFichierPdf, televerserPdf } from "@/lib/documents/televersement-pdf";
import { sauvegarderDocumentAction } from "@/lib/store/document-actions";

export interface WorkspaceDocumentProps {
  /** Identifiant canonique du document (ex: identifiant fiche ou slug). */
  id: string;
  /** Corps Markdown brut initial. */
  contenuInitial: string;
  /** Horodatage pour contrôle de concurrence optimiste. */
  updatedAtInitial?: string;
  /** Pièces jointes (PDF / supports) initiales. */
  piecesInitiales?: PieceJointeDocument[];
  /** Données de composition (si document de type séance). */
  donneesSeance?: DonneesSeance;
  /** URL de retour personnalisé. */
  retour?: string;
}

const LIBELLE_VISEE: Record<string, string> = {
  application: "Mettre en œuvre",
  transfert: "Transférer à un contexte nouveau",
  integration: "Intégrer plusieurs compétences",
};

const CONSIGNES_PAR_TYPE: Record<string, string> = {
  article: "Lis le papier, puis transforme sa lecture en fiche et en cas d’application.",
  cours: "Reprends le cours, structure ce qui est important et montre comment l’utiliser.",
  formule: "Explique les formules, leurs variables, puis applique-les à un cas concret.",
  reference: "Lis la référence, garde les passages utiles et montre quand t’y reporter.",
  livre: "Parcours les chapitres utiles et transforme la lecture en fiche exploitable.",
  note: "Clarifie cette note et transforme-la en ressource réutilisable.",
  reflexion: "Développe la réflexion et fais émerger une conclusion applicable.",
};

const SECTION_LIENS = "Déroulé";

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
              <Link href="/seances" className="font-medium text-primaire hover:underline">
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

/**
 * Espace de travail documentaire unifié de l'Atelier.
 *
 * Remplace et fédère les 3 workspaces précédents (Projet, Support PDF, Note opérationnelle)
 * dans une seule surface homogène et cohérente.
 */
export function WorkspaceDocument({
  id,
  contenuInitial,
  updatedAtInitial,
  piecesInitiales = [],
  donneesSeance,
  retour,
}: WorkspaceDocumentProps) {
  const [contenu, setContenu] = useState(contenuInitial);
  const [updatedAt, setUpdatedAt] = useState(updatedAtInitial);
  const [pieces, setPieces] = useState(piecesInitiales);
  const [enregistrement, setEnregistrement] = useState(false);
  const [televersement, setTeleversement] = useState(false);
  const [depotActif, setDepotActif] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const analyse = useMemo(() => analyserDocumentMarkdown(id, contenu), [id, contenu]);
  const definition = analyse.type ? definitionTypeDocument(analyse.type) : null;
  const sections = useMemo(() => definition?.sections ?? ["Contenu"], [definition]);
  const sectionsJournal = useMemo(
    () => new Set(definition?.sectionsJournal ?? []),
    [definition],
  );
  const sectionsSaisies = sections.filter((section) => !sectionsJournal.has(section));

  const [valeurs, setValeurs] = useState<ValeursSections>(() =>
    lireValeursSections(contenuInitial, sections),
  );

  const estSupport = analyse.frontMatter.role === "support";
  const estProjet = analyse.type === "projet";
  const estOperationnel = definition?.categorie === "action" && analyse.frontMatter.role === "operationnel";

  // --- Données spécifiques Projet ---
  const ficheProjet = useMemo(() => (estProjet ? analyserFicheProjet(valeurs) : null), [estProjet, valeurs]);
  const faitsProjet = useMemo(
    () => (estProjet ? lireJalonsFaits(analyse.frontMatter) : new Set<number>()),
    [estProjet, analyse.frontMatter],
  );
  const viseeProjet = typeof analyse.frontMatter.projet_visee === "string"
    ? analyse.frontMatter.projet_visee
    : undefined;
  const totalJalons = ficheProjet?.jalons.length ?? 0;
  const jalonsCoches = ficheProjet?.jalons.filter((_, index) => faitsProjet.has(index + 1)).length ?? 0;

  // --- Données spécifiques Note Opérationnelle & Séance ---
  const domaineDeclare = analyse.frontMatter.domaine;
  const domaineInitial =
    typeof domaineDeclare === "string" && domaineDeclare !== "transversal"
      ? domaineDeclare
      : undefined;
  const contexteInitial =
    typeof analyse.frontMatter.contexte === "string"
      ? analyse.frontMatter.contexte
      : undefined;
  const themeIdDeclare = analyse.frontMatter.theme_id;
  const themeInitial =
    typeof themeIdDeclare === "string"
      ? donneesSeance?.themes.find((theme) => theme.id === themeIdDeclare)
      : undefined;
  const domaineLibelle = domaineInitial
    ? donneesSeance?.domaines.find((domaine) => domaine.id === domaineInitial)?.nom
    : undefined;

  const renseignees = sectionsSaisies.filter((section) => valeurs[section]?.trim()).length;

  // --- Actions de sauvegarde ---
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
      setMessage("Fiche enregistrée.");
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "La fiche n’a pas pu être enregistrée.");
    } finally {
      setEnregistrement(false);
    }
  }

  // --- Gestion Projet : Jalons ---
  async function basculerJalon(numero: number) {
    const suivants = new Set(faitsProjet);
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
      setErreur(cause instanceof Error ? cause.message : "L'avancement n'a pas pu être enregistré.");
    }
  }

  // --- Gestion Support : Pièces jointes PDF ---
  async function ajouterPdf(fichier: File | undefined) {
    if (!fichier || televersement) return;
    const messageErreur = erreurFichierPdf(fichier);
    if (messageErreur) {
      setErreur(messageErreur);
      return;
    }
    setTeleversement(true);
    setMessage(null);
    setErreur(null);
    try {
      const piece = await televerserPdf(id, fichier);
      setPieces((anciennes) => [piece, ...anciennes]);
      setMessage("PDF attaché à la ressource.");
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Le PDF n’a pas pu être attaché.");
    } finally {
      setTeleversement(false);
    }
  }

  function lireFichier(event: ChangeEvent<HTMLInputElement>) {
    void ajouterPdf(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  function deposerFichier(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDepotActif(false);
    void ajouterPdf(event.dataTransfer.files?.[0]);
  }

  // --- Inscription automatique séance ---
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

  const titre = analyse.titre || "Fiche documentaire";
  const surtitre = definition ? `Fiche · ${definition.libelle}` : "Fiche documentaire";

  const barreEntete = estProjet && totalJalons > 0 ? (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[0.6875rem] text-texte-attenue">
        <span>Étapes déclarées faites</span>
        <span className="chiffres font-medium">{jalonsCoches} / {totalJalons}</span>
      </div>
      <BarreProgression
        fraction={jalonsCoches / totalJalons}
        libelle={`${jalonsCoches} étape(s) déclarée(s) faite(s) sur ${totalJalons}`}
      />
    </div>
  ) : estOperationnel && sectionsSaisies.length > 0 ? (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3 text-[0.6875rem] text-texte-attenue">
        <span>Parties remplies</span>
        <span className="chiffres font-medium">{renseignees} / {sectionsSaisies.length}</span>
      </div>
      <BarreProgression
        fraction={sectionsSaisies.length > 0 ? renseignees / sectionsSaisies.length : 0}
        libelle={`${renseignees} section(s) renseignée(s) sur ${sectionsSaisies.length}`}
      />
    </div>
  ) : undefined;

  return (
    <CoquilleWorkspace
      surtitre={surtitre}
      titre={titre}
      sortie={sortieWorkspace(retour)}
      barre={barreEntete}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {erreur && (
          <BandeauInfo ton="danger" taille="compacte">
            <p>{erreur}</p>
          </BandeauInfo>
        )}

        {/* 1. VUE PROJET */}
        {estProjet && ficheProjet && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {ficheProjet.dureeMin !== undefined && (
                <span className="rounded-full border border-bordure bg-surface-2 px-2.5 py-1">
                  <span className="chiffres font-medium">{ficheProjet.dureeMin}</span> min
                </span>
              )}
              {viseeProjet && (
                <span className="rounded-full border border-bordure bg-surface-2 px-2.5 py-1">
                  {LIBELLE_VISEE[viseeProjet] ?? viseeProjet}
                </span>
              )}
              {ficheProjet.competences.length > 0 && (
                <span className="rounded-full border border-bordure bg-surface-2 px-2.5 py-1">
                  <span className="chiffres font-medium">{ficheProjet.competences.length}</span> compétence(s) visée(s)
                </span>
              )}
            </div>

            {ficheProjet.brief && (
              <Carte>
                <div className="px-5 py-4">
                  <h2 className="font-serif text-lg font-medium">Le sujet</h2>
                  <div className="mt-2 text-sm leading-relaxed text-texte-attenue">
                    <Markdown contenu={ficheProjet.brief} />
                  </div>
                </div>
              </Carte>
            )}

            {ficheProjet.competences.length > 0 && (
              <section className="space-y-2">
                <h2 className="font-serif text-lg font-medium">Ce que ce projet fait travailler</h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {ficheProjet.competences.map((competence) => (
                    <li key={competence.code}>
                      <Link
                        href={`/atelier?document=${encodeURIComponent(competence.code)}`}
                        className="block h-full rounded-lg border border-bordure bg-surface-2/60 px-3 py-2.5 transition-colors hover:border-primaire/40 hover:bg-primaire-faible/25"
                      >
                        <span className="font-mono text-[0.6875rem] text-primaire">{competence.code}</span>
                        <span className="mt-0.5 block text-sm leading-snug">{competence.intitule}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {ficheProjet.jalons.length > 0 && (
              <section className="space-y-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-serif text-lg font-medium">Les étapes</h2>
                  <p className="text-[0.6875rem] text-texte-discret">
                    Cocher une étape déclare qu&apos;elle est faite — aucune Observation n&apos;en découle.
                  </p>
                </div>
                <ol className="space-y-2">
                  {ficheProjet.jalons.map((jalon, index) => {
                    const numero = index + 1;
                    const fait = faitsProjet.has(numero);
                    return (
                      <li key={`${jalon.titre}-${index}`}>
                        <div className={cx(
                          "flex gap-3 rounded-lg border px-3 py-3 transition-colors",
                          fait ? "border-succes/35 bg-succes-faible/25" : "border-bordure bg-surface",
                        )}>
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
                                <span className="chiffres text-[0.6875rem] text-texte-discret">{numero}</span>
                                <span className={cx("text-sm font-medium", fait && "text-texte-attenue line-through")}>
                                  {jalon.titre}
                                </span>
                              </span>
                              <span className="mt-1 block text-sm text-texte-attenue">{jalon.consigne}</span>
                            </span>
                          </label>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </div>
        )}

        {/* 2. VUE SUPPORT / RESSOURCE AVEC ATTACHEMENTS */}
        {estSupport && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <section className="min-w-0 rounded-xl border border-bordure bg-surface-2 p-4 sm:p-6">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-primaire">Cas d’application</p>
              <h2 className="mt-2 font-serif text-2xl font-medium">Travaille cette ressource</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-texte-attenue">
                {CONSIGNES_PAR_TYPE[analyse.type ?? ""] ?? "Lis la ressource et transforme-la en fiche de travail exploitable."}
              </p>
              <label className="mt-5 block">
                <span className="text-xs font-semibold uppercase tracking-wide text-texte-discret">Ta fiche de travail</span>
                <textarea
                  value={valeurs[sections[0]] ?? ""}
                  onChange={(event) => {
                    const v = event.target.value;
                    setValeurs((anciennes) => ({ ...anciennes, [sections[0]]: v }));
                    setMessage(null);
                  }}
                  disabled={enregistrement}
                  rows={20}
                  className="mt-2 min-h-[28rem] w-full resize-y rounded-lg border border-bordure-controle bg-surface px-4 py-3 text-sm leading-relaxed outline-none focus:border-primaire"
                  placeholder="Écris ici ce que tu comprends, les points importants et ton cas d’application…"
                />
              </label>
            </section>

            <aside className="space-y-4">
              <section className="rounded-xl border border-bordure bg-surface-2 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">Ressource attachée</p>
                <div
                  className={cx(
                    "mt-3 rounded-lg border border-dashed px-3 py-4 text-center transition-colors",
                    depotActif ? "border-primaire bg-primaire-faible/35" : "border-bordure-contraste",
                  )}
                  onDragEnter={(event) => { event.preventDefault(); setDepotActif(true); }}
                  onDragOver={(event) => { event.preventDefault(); setDepotActif(true); }}
                  onDragLeave={(event) => { if (event.currentTarget === event.target) setDepotActif(false); }}
                  onDrop={deposerFichier}
                >
                  <input id={`workspace-pdf-${id}`} type="file" accept="application/pdf,.pdf" onChange={lireFichier} className="sr-only" />
                  <label htmlFor={`workspace-pdf-${id}`} className="cursor-pointer text-xs font-medium hover:text-primaire">
                    {televersement ? "Ajout du PDF…" : "Déposer ou choisir un PDF"}
                  </label>
                  <p className="mt-1 text-[0.6875rem] text-texte-discret">10 Mo maximum</p>
                </div>
                {pieces.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {pieces.map((piece) => (
                      <li key={piece.id}>
                        {piece.url ? (
                          <a href={piece.url} target="_blank" rel="noreferrer" className="block truncate text-xs font-medium text-primaire hover:underline" title={piece.nom}>
                            {piece.nom}
                          </a>
                        ) : (
                          <span className="block truncate text-xs">{piece.nom}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </aside>
          </div>
        )}

        {/* 3. FORMULAIRE DE SECTIONS UNIFIÉ (POUR PROJETS, NOTES OPÉRATIONNELLES & AUTRES) */}
        {!estSupport && (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void enregistrer();
            }}
          >
            {donneesSeance && (
              <div className="rounded-lg border border-primaire/20 bg-primaire-faible/35 px-4 py-3 text-sm leading-relaxed text-texte-attenue">
                Cette page est le carnet de ta séance{themeInitial ? ` sur « ${themeInitial.libelle} »` : domaineLibelle ? ` dans « ${domaineLibelle} »` : ""}.
                La composition ci-dessous choisira les exercices dans ce périmètre.
              </div>
            )}

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
                      id={`doc-${id}-${index}`}
                      label={`Contenu — ${section}`}
                      multiligne
                      rows={6}
                      value={valeurs[section] ?? ""}
                      onChange={(event) => {
                        const v = event.target.value;
                        setValeurs((anciennes) => ({ ...anciennes, [section]: v }));
                        setMessage(null);
                      }}
                      disabled={enregistrement}
                      className="min-h-28 resize-y leading-relaxed"
                    />
                  )}
                </section>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-bordure pt-4">
              <p className="text-xs text-texte-discret">
                {renseignees} section{renseignees > 1 ? "s" : ""} renseignée{renseignees > 1 ? "s" : ""} sur {sectionsSaisies.length}.
              </p>
              <Bouton type="submit" variante="principal" enChargement={enregistrement}>
                Enregistrer la fiche
              </Bouton>
            </div>
          </form>
        )}

        {/* Bouton d'enregistrement pour vue Support */}
        {estSupport && (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-bordure pt-4">
            <Bouton type="button" variante="principal" onClick={() => void enregistrer()} enChargement={enregistrement}>
              Enregistrer la fiche
            </Bouton>
          </div>
        )}

        {message && !erreur && (
          <p className="text-xs text-succes" role="status">
            {message}
          </p>
        )}
      </div>
    </CoquilleWorkspace>
  );
}
