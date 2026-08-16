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
 * Sans elle, un projet produirait des preuves sur des compétences que personne
 * n'a confirmées.
 */

import { useEffect, useMemo, useState } from "react";
import type { PropositionContenuActivite, PropositionTheme } from "@/lib/tutor/outils";
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
import { BandeauInfo, Bouton, Etiquette } from "@/components/ui/primitives";

const LIBELLE_VISEE: Record<ViseeProjet, string> = {
  application: "Mettre en œuvre",
  transfert: "Transférer à un contexte nouveau",
  integration: "Intégrer plusieurs compétences",
};

export function ModaleNouveauProjet({ accountId }: { accountId: string }) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <>
      <Bouton type="button" onClick={() => setOuverte(true)} data-testid="ouvrir-modale-projet">
        Créer un projet
      </Bouton>
      {ouverte && <ParcoursNouveauProjet accountId={accountId} onFermer={() => setOuverte(false)} />}
    </>
  );
}

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

  const complet = codesRetenus.length >= COMPETENCES_MAX;
  const dejaCitees = new Set((designees ?? []).map((competence) => competence.code));
  const terme = recherche.trim().toLowerCase();
  /*
   * Les candidates à l'ajout : tout le référentiel actif sauf ce qui est déjà
   * dans la liste. Filtrées seulement quand on tape — afficher les 77 d'un coup
   * transformerait le geste « j'en veux une de plus » en inventaire à trier,
   * exactement ce que le compositeur de séance a retiré.
   */
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
    setEnCours(true);
    setErreur(null);
    setProgression(null);
    try {
      const reponse = await fetch("/api/themes/resoudre", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ texte: intention.trim(), config: lireConfigTuteur(accountId) ?? undefined }),
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
            const theme = (JSON.parse(donnees) as { theme: PropositionTheme | null }).theme;
            if (!theme) throw new Error("Le tuteur n'a rendu aucun ciblage exploitable.");
            if (theme.codes.length === 0) {
              throw new Error(
                "Aucune compétence de ton référentiel ne correspond à cette description. Crée d'abord la branche correspondante depuis l'Atelier.",
              );
            }
            setDesignees(theme.codes.map((code) => ({ code, origine: "tuteur" as const })));
            setJustification(theme.justification ?? "");
            /*
              Le tuteur désigne ce qu'il trouve — rien ne le borne à
              `COMPETENCES_MAX`, et il en rend régulièrement plus. Le surplus
              est mis de côté ici, explicitement : le couper en silence à
              l'envoi affichait huit compétences actives sous un message
              disant qu'il y en avait six. Elles restent là, échangeables.
            */
            setRetirees(new Set(theme.codes.slice(COMPETENCES_MAX)));
          } else if (type === "erreur") {
            recu = true;
            throw new Error((JSON.parse(donnees) as { message: string }).message);
          } else if (type === "proposition-en-cours") {
            setProgression("Le tuteur cherche dans tes compétences…");
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
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Génération impossible.");
    } finally {
      setEnCours(false);
    }
  }

  // ---- Temps 1 : la phrase -------------------------------------------------
  if (!designees) {
    return (
      <Modale
        titre="Créer un projet"
        sousTitre="Décris ce que tu veux travailler. Rien n'est enregistré avant ton acceptation."
        onFermer={onFermer}
        pied={
          <>
            <Bouton type="button" variante="secondaire" onClick={onFermer}>Annuler</Bouton>
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
        }
      >
        <div className="space-y-4">
          {erreur && <BandeauInfo ton="danger">{erreur}</BandeauInfo>}
          {progression && <BandeauInfo taille="compacte">{progression}</BandeauInfo>}
          <Champ
            label="Ce que tu veux travailler"
            name="intention"
            multiligne
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
      </Modale>
    );
  }

  // ---- Temps 2 : les compétences désignées, à confirmer ---------------------
  if (!proposition) {
    return (
      <Modale
        titre="Ce que ce projet mettrait en jeu"
        sousTitre="Le tuteur a désigné ces compétences dans ton référentiel. Retire celles qui n'ont pas leur place."
        onFermer={onFermer}
        pied={
          <>
            <Bouton type="button" variante="secondaire" onClick={() => setDesignees(null)}>
              Revenir à la description
            </Bouton>
            <Bouton
              type="button"
              onClick={proposerSujet}
              disabled={codesRetenus.length === 0 || enCours}
              enChargement={enCours}
              data-testid="generer-projet"
            >
              Proposer un sujet
            </Bouton>
          </>
        }
      >
        <div className="space-y-4">
          {erreur && <BandeauInfo ton="danger">{erreur}</BandeauInfo>}
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
                    {/*
                      L'intitulé, s'il est connu. Pas de repli inventé : une
                      compétence dont le référentiel n'a rien à dire n'affiche
                      que son code, qui reste exact.
                    */}
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
                    // Remettre une compétence quand six sont déjà retenues
                    // dépasserait le plafond que le serveur refuse.
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

          {/*
            Ajouter ce que le tuteur n'a pas vu.

            Il ne désigne que ce que la description laissait entendre ; une
            compétence qu'on veut mobiliser sans l'avoir écrite n'a aucune
            raison d'être hors d'atteinte. On ne peut choisir que dans le
            référentiel actif — le geste ajoute une compétence au projet, il
            n'en crée aucune (le serveur refuse d'ailleurs tout code hors
            référentiel).
          */}
          <div className="space-y-2 border-t border-bordure pt-3">
            <Champ
              label="Ajouter une compétence"
              value={recherche}
              onChange={(event) => setRecherche(event.target.value)}
              disabled={complet || catalogue === null}
              placeholder="Cherche par intitulé, code ou domaine"
              aide={
                catalogue === null
                  ? "Lecture de ton référentiel…"
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
            ne porte ne recevra aucune preuve.
          </p>
        </div>
      </Modale>
    );
  }

  // ---- Temps 3 : le sujet, à relire ----------------------------------------
  const contenu = proposition.famille === "produire" ? proposition : null;

  return (
    <Modale
      titre="Relire avant d'ouvrir"
      sousTitre="Tout reste modifiable. Rien n'est enregistré tant que tu n'ouvres pas le projet."
      largeur="3xl"
      onFermer={onFermer}
      pied={
        <form action={ouvrirProjetCompose} className="flex flex-wrap gap-2">
          {codesRetenus.map((code) => <input key={code} type="hidden" name="skillCodes" value={code} />)}
          <input type="hidden" name="objectif" value={intention.trim()} />
          <input type="hidden" name="dureeMin" value={String(dureeMin)} />
          <input type="hidden" name="capacite" value={capacite} />
          <input type="hidden" name="visee" value={visee} />
          <input type="hidden" name="contraintes" value="" />
          <input type="hidden" name="proposition" value={JSON.stringify(proposition)} />
          <Bouton type="button" variante="secondaire" onClick={proposerSujet} disabled={enCours}>
            Régénérer
          </Bouton>
          <Bouton type="submit" data-testid="ouvrir-projet">Ouvrir le projet</Bouton>
        </form>
      }
    >
      <div className="space-y-4">
        {erreur && <BandeauInfo ton="danger">{erreur}</BandeauInfo>}
        <Champ
          label="Titre"
          value={proposition.titre}
          onChange={(event) => setProposition({ ...proposition, titre: event.target.value })}
        />
        <Champ
          label="Brief"
          multiligne
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
    </Modale>
  );
}
