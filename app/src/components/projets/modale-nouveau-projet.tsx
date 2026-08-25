"use client";

/**
 * Ouvrir un projet à partir d'une phrase.
 *
 * Trois temps, sans changer d'écran : tu décris ce que tu veux travailler, le
 * tuteur **désigne** les compétences de ton référentiel qui s'y rattachent, tu
 * confirmes d'un coup d'œil, il propose un sujet que tu relis.
 *
 * La confirmation n'est pas une formalité qu'on pourrait retirer : le tuteur
 * ne frappe aucun code, il n'en désigne que parmi ceux que le serveur lui
 * donne, et un rattachement de compétence n'entre qu'après validation humaine.
 * Sans elle, un projet produirait des observations sur des compétences que personne
 * n'a confirmées.
 */

import { useEffect, useMemo, useState } from "react";
import type { PropositionContenuActivite } from "@/lib/tutor/outils";
import type { TraductionIntention } from "@/lib/domain/intention";
import type { EvaluationCriterion } from "@/lib/domain/adaptive-learning";
import { lireConfigTuteur } from "@/lib/tutor/cle-client";
import { ouvrirProjetCompose } from "@/lib/store/projets-actions";
import { lireCompetencesActives, type CompetenceLisible } from "@/lib/store/referentiel-actions";
import {
  COMPETENCES_MAX,
  DUREE_PROJET_MAX,
  DUREE_PROJET_MIN,
  VISEES_PROJET,
  type ViseeProjet,
} from "@/lib/domain/composition-projet";
import { Modale } from "@/components/ui/modale";
import { Champ, ChampSelect } from "@/components/ui/champ";
import { PaletteFormulesTexte } from "@/components/ui/palette-formules";
import { BandeauInfo, Bouton, Etiquette, cx } from "@/components/ui/primitives";

const LIBELLE_VISEE: Record<ViseeProjet, string> = {
  application: "Mettre en œuvre",
  transfert: "Transférer à un contexte nouveau",
  integration: "Intégrer plusieurs compétences",
};

interface CompetenceDesignee {
  code: string;
  /**
   * Qui l'a mise là.
   *
   * Le tuteur désigne, la personne complète. Les distinguer n'est pas
   * décoratif : ce qui vient du tuteur est une proposition qu'on relit, ce
   * qu'on ajoute soi-même est une décision déjà prise — et la justification
   * affichée au-dessus ne parle que des premières.
   */
  origine: "tuteur" | "utilisateur";
}

/**
 * Le parcours seul, sans son déclencheur.
 *
 * Exporté pour « Travailler un domaine » : le choix du format y est déjà fait,
 * et le titre saisi sert d'amorce à la description. Rouvrir un second bouton
 * « Créer un projet » ailleurs redemanderait ce que la personne vient de dire.
 */
export function ParcoursNouveauProjet({
  accountId,
  intentionInitiale = "",
  onFermer,
}: {
  accountId: string;
  intentionInitiale?: string;
  onFermer: () => void;
}) {
  const [intention, setIntention] = useState(intentionInitiale);
  const [dureeMin, setDureeMin] = useState(120);
  const [capacite, setCapacite] = useState("standard");
  const [visee, setVisee] = useState<ViseeProjet>("application");

  const [designees, setDesignees] = useState<CompetenceDesignee[] | null>(null);
  const [justification, setJustification] = useState("");
  const [retirees, setRetirees] = useState<Set<string>>(new Set());
  const [proposition, setProposition] = useState<PropositionContenuActivite | null>(null);
  const [criteres, setCriteres] = useState<EvaluationCriterion[]>([]);
  const [enCours, setEnCours] = useState(false);
  const [progression, setProgression] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [catalogue, setCatalogue] = useState<CompetenceLisible[] | null>(null);
  const [recherche, setRecherche] = useState("");

  const [etape, setEtape] = useState<1 | 2 | 3>(1);
  const [intentionCiblee, setIntentionCiblee] = useState("");
  const [confirmerAbandon, setConfirmerAbandon] = useState(false);

  /*
   * Le référentiel actif, pour nommer ce que le tuteur désigne et pour offrir
   * ce qu'il n'a pas désigné. Chargé une fois, à l'ouverture : le ciblage dure
   * plusieurs secondes, la liste sera là bien avant l'écran qui l'utilise. Un
   * échec ne bloque rien — on retombe sur le code seul, qui reste exact.
   */
  useEffect(() => {
    let vivant = true;
    lireCompetencesActives()
      .then((competences) => {
        if (vivant) setCatalogue(competences);
      })
      .catch(() => {
        if (vivant) setCatalogue([]);
      });
    return () => {
      vivant = false;
    };
  }, []);

  const parCode = useMemo(
    () => new Map((catalogue ?? []).map((competence) => [competence.code, competence])),
    [catalogue],
  );

  /*
   * Plus de `.slice(0, COMPETENCES_MAX)` ici : une coupe muette faisait mentir
   * l'écran, qui montrait huit lignes actives pour six codes envoyés. Le
   * plafond est tenu par les deux gestes qui pourraient le franchir — remettre
   * et ajouter — tous deux fermés quand la liste est pleine.
   */
  const codesRetenus = (designees ?? [])
    .map((competence) => competence.code)
    .filter((code) => !retirees.has(code));

  const codesEffectifs = useMemo(() => {
    if (codesRetenus.length > 0) return codesRetenus;
    if (criteres.length > 0) {
      return [...new Set(criteres.map((c) => c.skillCode).filter(Boolean))];
    }
    return [];
  }, [codesRetenus, criteres]);

  const complet = codesRetenus.length >= COMPETENCES_MAX;
  const dejaCitees = new Set((designees ?? []).map((competence) => competence.code));
  const terme = recherche.trim().toLowerCase();

  const candidates =
    terme.length === 0
      ? []
      : (catalogue ?? [])
          .filter((competence) => !dejaCitees.has(competence.code))
          .filter(
            (competence) =>
              competence.intitule.toLowerCase().includes(terme) ||
              competence.code.toLowerCase().includes(terme) ||
              competence.domaineNom.toLowerCase().includes(terme),
          )
          .slice(0, 8);

  function ajouter(code: string) {
    setDesignees((actuelles) => [...(actuelles ?? []), { code, origine: "utilisateur" }]);
    setRetirees((actuelles) => {
      const suivantes = new Set(actuelles);
      suivantes.delete(code);
      return suivantes;
    });
    setRecherche("");
  }

  /** Étape 1 : la phrase devient des codes existants, jamais des codes neufs. */
  async function cibler() {
    const texteIntention = intention.trim();
    if (texteIntention === intentionCiblee && designees && designees.length > 0) {
      setEtape(2);
      return;
    }

    setEnCours(true);
    setErreur(null);
    setProgression(null);
    try {
      const reponse = await fetch("/api/intention", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ besoin: texteIntention, config: lireConfigTuteur(accountId) ?? undefined }),
      });
      if (!reponse.ok || !reponse.body) {
        const corps = await reponse.json().catch(() => null) as { message?: string } | null;
        throw new Error(corps?.message ?? "Le ciblage n'a pas pu démarrer.");
      }
      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";
      let recu = false;
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });
        const blocs = tampon.split("\n\n");
        tampon = blocs.pop() ?? "";
        for (const bloc of blocs) {
          const lignes = bloc.split("\n");
          const type = lignes.find((l) => l.startsWith("event:"))?.slice(6).trim() ?? "message";
          const donnees = lignes.find((l) => l.startsWith("data:"))?.slice(5).trim();
          if (!donnees) continue;
          if (type === "proposition") {
            recu = true;
            const proposition = (JSON.parse(donnees) as { proposition: TraductionIntention | null }).proposition;
            const codes = proposition?.action?.codes ?? [];
            if (codes.length === 0) {
              throw new Error(
                "Aucune compétence de votre référentiel ne correspond à cette description. Créez d'abord la branche correspondante depuis vos cours.",
              );
            }
            setDesignees(codes.map((code) => ({ code, origine: "tuteur" as const })));
            setJustification(proposition?.action?.pourquoi ?? "");
            setRetirees(new Set(codes.slice(COMPETENCES_MAX)));
            setIntentionCiblee(texteIntention);
            setEtape(2);
          } else if (type === "erreur") {
            recu = true;
            throw new Error((JSON.parse(donnees) as { message: string }).message);
          } else if (type === "proposition-en-cours") {
            setProgression("Le tuteur cherche dans vos compétences…");
          }
        }
      }
      if (!recu) throw new Error("Le tuteur n'a rien rendu.");
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Ciblage impossible.");
    } finally {
      setEnCours(false);
      setProgression(null);
    }
  }

  /** Étape 2 : le sujet, une fois les compétences confirmées. */
  async function proposerSujet() {
    setEnCours(true);
    setErreur(null);
    try {
      const reponse = await fetch("/api/projets/generer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillCodes: codesRetenus,
          objectif: intention.trim(),
          dureeMin,
          capacite,
          visee,
          contraintes: [],
          config: lireConfigTuteur(accountId) ?? undefined,
        }),
      });
      const corps = await reponse.json() as {
        proposition?: PropositionContenuActivite;
        criteres?: EvaluationCriterion[];
        message?: string;
      };
      if (!reponse.ok || !corps.proposition) {
        throw new Error(corps.message ?? "Le tuteur n'a rendu aucun contenu valide.");
      }
      setProposition(corps.proposition);
      setCriteres(corps.criteres ?? []);
      setEtape(3);
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Génération impossible.");
    } finally {
      setEnCours(false);
    }
  }

  function tenterFermeture() {
    if (etape > 1 && (proposition !== null || (designees !== null && designees.length > 0))) {
      setConfirmerAbandon(true);
    } else {
      onFermer();
    }
  }

  // Titres et métadonnées selon l'étape
  const titreModale =
    etape === 3
      ? "Relire avant d'ouvrir"
      : etape === 2
        ? "Ce que ce projet mettrait en jeu"
        : "Créer un projet";

  const sousTitreModale =
    etape === 3
      ? "Tout reste modifiable. Rien n'est enregistré tant que vous n'ouvrez pas le projet."
      : etape === 2
        ? "Le tuteur a désigné ces compétences dans votre référentiel. Retirez celles qui n'ont pas leur place."
        : "Décrivez ce que vous voulez travailler. Rien n'est enregistré avant votre acceptation.";

  const contenu = proposition?.famille === "produire" ? proposition : null;

  return (
    <Modale
      titre={titreModale}
      sousTitre={sousTitreModale}
      largeur={etape === 3 ? "3xl" : "2xl"}
      onFermer={tenterFermeture}
      pied={
        confirmerAbandon ? null : etape === 1 ? (
          <>
            <Bouton type="button" variante="secondaire" onClick={tenterFermeture}>
              Annuler
            </Bouton>
            <Bouton
              type="button"
              onClick={cibler}
              disabled={intention.trim().length < 10 || enCours}
              enChargement={enCours}
              data-testid="cibler-projet"
            >
              Continuer
            </Bouton>
          </>
        ) : etape === 2 ? (
          <>
            <Bouton type="button" variante="secondaire" onClick={() => setEtape(1)}>
              ← Revenir à la description
            </Bouton>
            <Bouton
              type="button"
              onClick={proposerSujet}
              disabled={codesRetenus.length === 0 || enCours}
              enChargement={enCours}
              data-testid="generer-projet"
            >
              Proposer un sujet →
            </Bouton>
          </>
        ) : (
          <form action={ouvrirProjetCompose} className="flex flex-wrap items-center justify-between w-full gap-2">
            <Bouton
              type="button"
              variante="discret"
              onClick={() => setEtape(2)}
              disabled={enCours}
            >
              ← Ajuster les compétences
            </Bouton>
            <div className="flex flex-wrap gap-2">
              {codesEffectifs.map((code) => <input key={code} type="hidden" name="skillCodes" value={code} />)}
              <input type="hidden" name="objectif" value={intention.trim()} />
              <input type="hidden" name="dureeMin" value={String(dureeMin)} />
              <input type="hidden" name="capacite" value={capacite} />
              <input type="hidden" name="visee" value={visee} />
              <input type="hidden" name="contraintes" value="" />
              <input type="hidden" name="proposition" value={JSON.stringify(proposition)} />
              <Bouton type="button" variante="secondaire" onClick={proposerSujet} disabled={enCours}>
                Régénérer
              </Bouton>
              <Bouton type="submit" disabled={codesEffectifs.length === 0 || enCours} data-testid="ouvrir-projet">
                Ouvrir le projet
              </Bouton>
            </div>
          </form>
        )
      }
    >
      <div className="space-y-4">
        {/* Stepper visuel d'avancement */}
        <div className="flex items-center justify-between rounded-lg border border-bordure bg-surface-2/40 px-3 py-2 text-xs mb-2">
          <button
            type="button"
            onClick={() => setEtape(1)}
            className={cx(
              "flex items-center gap-1.5 font-medium transition-colors",
              etape === 1 ? "text-primaire font-semibold" : "text-texte-attenue hover:text-texte",
            )}
          >
            <span
              className={cx(
                "flex size-5 items-center justify-center rounded-full text-[0.6875rem]",
                etape === 1
                  ? "bg-primaire text-primaire-contraste"
                  : "bg-surface border border-bordure",
              )}
            >
              1
            </span>
            <span>Intention</span>
          </button>
          <span className="text-texte-discret">→</span>
          <button
            type="button"
            onClick={() => {
              if (designees && designees.length > 0) {
                setEtape(2);
              }
            }}
            disabled={!designees || designees.length === 0}
            className={cx(
              "flex items-center gap-1.5 font-medium transition-colors",
              etape === 2
                ? "text-primaire font-semibold"
                : designees && designees.length > 0
                  ? "text-texte-attenue hover:text-texte"
                  : "text-texte-discret cursor-not-allowed",
            )}
          >
            <span
              className={cx(
                "flex size-5 items-center justify-center rounded-full text-[0.6875rem]",
                etape === 2
                  ? "bg-primaire text-primaire-contraste"
                  : designees && designees.length > 0
                    ? "bg-primaire/20 text-primaire"
                    : "bg-surface border border-bordure",
              )}
            >
              2
            </span>
            <span>Compétences {codesEffectifs.length > 0 ? `(${codesEffectifs.length})` : ""}</span>
          </button>
          <span className="text-texte-discret">→</span>
          <button
            type="button"
            onClick={() => {
              if (proposition) {
                setEtape(3);
              }
            }}
            disabled={!proposition}
            className={cx(
              "flex items-center gap-1.5 font-medium transition-colors",
              etape === 3
                ? "text-primaire font-semibold"
                : proposition
                  ? "text-texte-attenue hover:text-texte"
                  : "text-texte-discret cursor-not-allowed",
            )}
          >
            <span
              className={cx(
                "flex size-5 items-center justify-center rounded-full text-[0.6875rem]",
                etape === 3
                  ? "bg-primaire text-primaire-contraste"
                  : "bg-surface border border-bordure",
              )}
            >
              3
            </span>
            <span>Revue & Jalons</span>
          </button>
        </div>

        {/* Garde-fou d'abandon si travail en cours */}
        {confirmerAbandon && (
          <div className="rounded-xl border border-alerte/40 bg-alerte/10 p-4 text-center space-y-2.5">
            <p className="text-sm font-semibold text-alerte">Abandonner la création du projet ?</p>
            <p className="text-xs text-texte-attenue">
              Les compétences identifiées et les jalons proposés seront effacés.
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <Bouton type="button" variante="secondaire" onClick={() => setConfirmerAbandon(false)}>
                Continuer l&apos;édition
              </Bouton>
              <Bouton type="button" variante="danger" onClick={onFermer}>
                Confirmer l&apos;abandon
              </Bouton>
            </div>
          </div>
        )}

        {!confirmerAbandon && (
          <>
            {erreur && <BandeauInfo ton="danger">{erreur}</BandeauInfo>}
            {progression && <BandeauInfo taille="compacte">{progression}</BandeauInfo>}

            {/* ---- Étape 1 : Intention & Format ---- */}
            {etape === 1 && (
              <div className="space-y-4">
                <Champ
                  label="Ce que vous voulez travailler"
                  name="intention"
                  multiligne
                  formules
                  rows={5}
                  value={intention}
                  onChange={(event) => setIntention(event.target.value)}
                  aide="Une phrase suffit. Exemple : « je construis une application web et je veux structurer sa base de données »."
                />
                <div className="grid gap-3 md:grid-cols-3">
                  <Champ
                    label="Durée estimée (min)"
                    name="dureeMin"
                    type="number"
                    min={DUREE_PROJET_MIN}
                    max={DUREE_PROJET_MAX}
                    value={String(dureeMin)}
                    onChange={(event) => setDureeMin(Number(event.target.value))}
                    aide="Reprenable par segments."
                  />
                  <ChampSelect
                    label="Exigence"
                    name="capacite"
                    value={capacite}
                    onChange={(event) => setCapacite(event.target.value)}
                    options={[
                      { valeur: "faible", libelle: "Légère" },
                      { valeur: "standard", libelle: "Standard" },
                      { valeur: "elevee", libelle: "Élevée" },
                    ]}
                  />
                  <ChampSelect
                    label="Visée"
                    name="visee"
                    value={visee}
                    onChange={(event) => setVisee(event.target.value as ViseeProjet)}
                    options={VISEES_PROJET.map((valeur) => ({ valeur, libelle: LIBELLE_VISEE[valeur] }))}
                  />
                </div>
              </div>
            )}

            {/* ---- Étape 2 : Compétences désignées ---- */}
            {etape === 2 && designees && (
              <div className="space-y-4">
                {justification && (
                  <BandeauInfo taille="compacte">« {justification} »</BandeauInfo>
                )}
                {designees.length > COMPETENCES_MAX && (
                  <BandeauInfo ton="info" taille="compacte">
                    <p>
                      Le tuteur en a désigné {designees.length}. Un projet en porte{" "}
                      {COMPETENCES_MAX} au plus : les {designees.length - COMPETENCES_MAX} dernières
                      sont mises de côté ci-dessous. Échange-les si ce ne sont pas les bonnes.
                    </p>
                  </BandeauInfo>
                )}
                <ul className="space-y-2" data-testid="competences-designees">
                  {designees.map((competence) => {
                    const retiree = retirees.has(competence.code);
                    const connue = parCode.get(competence.code);
                    return (
                      <li key={competence.code} className="flex items-start justify-between gap-3 rounded-md border border-bordure px-3 py-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Etiquette ton={retiree ? undefined : "primaire"}>{competence.code}</Etiquette>
                            {competence.origine === "utilisateur" && (
                              <span className="text-[0.6875rem] uppercase tracking-wide text-texte-discret">
                                ajoutée par toi
                              </span>
                            )}
                          </div>
                          {connue && (
                            <p className={retiree ? "mt-1 text-sm text-texte-discret line-through" : "mt-1 text-sm"}>
                              {connue.intitule}
                            </p>
                          )}
                          {connue && (
                            <p className="mt-0.5 text-[0.6875rem] text-texte-discret">{connue.domaineNom}</p>
                          )}
                        </div>
                        <Bouton
                          type="button"
                          variante="discret"
                          disabled={retiree && complet}
                          title={retiree && complet ? `Maximum atteint : ${COMPETENCES_MAX} compétences.` : undefined}
                          onClick={() => setRetirees((actuelles) => {
                            const suivantes = new Set(actuelles);
                            if (retiree) suivantes.delete(competence.code);
                            else suivantes.add(competence.code);
                            return suivantes;
                          })}
                        >
                          {retiree ? "Remettre" : "Retirer"}
                        </Bouton>
                      </li>
                    );
                  })}
                </ul>

                <div className="space-y-2 border-t border-bordure pt-3">
                  <Champ
                    label="Ajouter une compétence"
                    value={recherche}
                    onChange={(event) => setRecherche(event.target.value)}
                    disabled={complet || catalogue === null}
                    placeholder="Cherche par intitulé, code ou domaine"
                    aide={
                      catalogue === null
                        ? "Lecture de votre référentiel…"
                        : complet
                          ? `Maximum atteint : ${COMPETENCES_MAX} compétences par projet. Retires-en une pour en ajouter une autre.`
                          : "Seules les compétences déjà au référentiel peuvent être mobilisées."
                    }
                  />
                  {candidates.length > 0 && (
                    <ul className="space-y-1" data-testid="competences-candidates">
                      {candidates.map((competence) => (
                        <li key={competence.code}>
                          <button
                            type="button"
                            onClick={() => ajouter(competence.code)}
                            className="flex w-full items-baseline gap-2 rounded-md border border-bordure px-3 py-2 text-left text-sm transition-colors hover:border-primaire/40 hover:bg-primaire-faible/35"
                          >
                            <span className="font-mono text-[0.6875rem] text-texte-discret">
                              {competence.code}
                            </span>
                            <span className="min-w-0 flex-1">{competence.intitule}</span>
                            <span className="text-[0.6875rem] text-texte-discret">
                              {competence.domaineNom}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {terme.length > 0 && candidates.length === 0 && catalogue !== null && !complet && (
                    <p className="text-xs text-texte-attenue">
                      Aucune compétence active ne correspond. Si le sujet n&apos;est couvert par
                      aucune, il faut d&apos;abord étendre le référentiel depuis l&apos;Atelier.
                    </p>
                  )}
                </div>

                <p className="text-xs text-texte-attenue">
                  {codesRetenus.length} compétence(s) retenue(s) sur {COMPETENCES_MAX} au plus. Chacune
                  recevra son critère d&apos;évaluation ; une compétence qu&apos;aucun critère démontré
                  ne porte ne recevra aucune observation.
                </p>
              </div>
            )}

            {/* ---- Étape 3 : Revue & Jalons ---- */}
            {etape === 3 && proposition && (
              <div className="space-y-4">
                <Champ
                  label="Titre"
                  value={proposition.titre}
                  onChange={(event) => setProposition({ ...proposition, titre: event.target.value })}
                />
                <Champ
                  label="Brief"
                  multiligne
                  formules
                  rows={6}
                  value={proposition.brief}
                  onChange={(event) => setProposition({ ...proposition, brief: event.target.value })}
                />
                <section>
                  <h3 className="text-sm font-medium">Étapes proposées</h3>
                  <ol className="mt-2 space-y-2 text-sm text-texte-attenue">
                    {proposition.jalons.map((jalon, index) => (
                      <li key={`${jalon.titre}-${index}`} className="rounded-md border border-bordure p-3">
                        <strong className="text-texte">{jalon.titre}</strong>
                        <p className="mt-1">{jalon.consigne}</p>
                        <p className="mt-1 text-xs text-texte-discret">Attendu : {jalon.resultatAttendu}</p>
                      </li>
                    ))}
                  </ol>
                </section>
                {contenu && (
                  <section>
                    <h3 className="text-sm font-medium">Sections du rendu</h3>
                    <ul className="mt-2 space-y-1 text-sm text-texte-attenue">
                      {contenu.workspace.canevasArtefact.map((section, index) => (
                        <li key={`${section.section}-${index}`}>
                          <span className="text-texte">{section.section}</span> — {section.consigne}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <section>
                  <h3 className="text-sm font-medium">Critères, connus d&apos;avance</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {criteres.map((critere) => (
                      <li key={critere.id} className="flex flex-wrap items-center gap-2">
                        <Etiquette ton="primaire">{critere.skillCode}</Etiquette>
                        <span className="text-texte-attenue">{critere.label}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </Modale>
  );
}
