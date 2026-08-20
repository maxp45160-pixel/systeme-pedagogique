"use client";

import type { EtatMoteur } from "@/lib/store/auto-evaluation";
import type { MetriqueMoteur } from "@/lib/engine/auto-evaluation";
import { PARAMETRE_PAR_NOM } from "@/lib/engine/reglages";
import { appliquerAjustementMoteur } from "@/lib/store/reglages-actions";
import { Bouton } from "@/components/ui/primitives";

/**
 * Le moteur jugé sur ses propres affirmations — ADR-085.
 *
 * Dans `/admin` et nulle part ailleurs : le moteur qui se note n'est pas un
 * écran d'apprentissage. Le voir n'aide personne à progresser, et le placer
 * dans le parcours ferait passer un pari du système pour une mesure sur la
 * personne.
 *
 * Une métrique sans valeur affiche « Données insuffisantes » et son compte
 * d'avancement — jamais un chiffre approximatif, jamais une barre à zéro. Une
 * barre vide se lit comme « mauvais » alors qu'elle veut dire « on ne sait
 * pas », et c'est précisément la confusion que P2 interdit.
 */

function formater(metrique: MetriqueMoteur): string {
  if (metrique.valeur === null) return "—";
  switch (metrique.unite) {
    case "minutes":
      return `${metrique.valeur.toFixed(0)} min`;
    case "part":
      return `${(metrique.valeur * 100).toFixed(0)} %`;
    case "ratio":
      return `× ${metrique.valeur.toFixed(2)}`;
    case "score":
      return metrique.valeur.toFixed(3);
  }
}

function Carte({ metrique }: { metrique: MetriqueMoteur }) {
  const mesuree = metrique.valeur !== null;
  const progression = Math.min(100, Math.round((metrique.n / metrique.seuil) * 100));

  return (
    <div className="rounded-xl border border-bordure bg-surface p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
          {metrique.libelle}
        </span>
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            mesuree ? "bg-succes-faible text-succes" : "bg-surface-2 text-texte-discret"
          }`}
        >
          {mesuree ? "Mesurée" : "En attente"}
        </span>
      </div>

      <p className="mt-3 text-2xl font-bold text-texte">{formater(metrique)}</p>

      {!mesuree && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-info transition-all"
              style={{ width: `${progression}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-texte-discret">
            {metrique.n} sur {metrique.seuil} observations nécessaires
          </p>
        </div>
      )}

      <p className="mt-3 text-xs text-texte-attenue">{metrique.lecture}</p>

      <dl className="mt-4 space-y-1 border-t border-bordure pt-3">
        {metrique.detail.map((d) => (
          <div key={d.libelle} className="flex items-baseline justify-between gap-3">
            <dt className="text-xs text-texte-discret">{d.libelle}</dt>
            <dd className="text-xs font-medium tabular-nums text-texte">{d.valeur}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Le pas suivant, quand une mesure le justifie.
 *
 * L&apos;application reste un geste explicite, et non un effet de bord du
 * rendu. Deux raisons, toutes deux temporaires : le modèle de prédiction
 * n&apos;a jamais été confronté au réel, si bien qu&apos;ajuster sur lui
 * reviendrait à corriger un instrument avec un instrument non étalonné ; et une
 * écriture pendant le rendu changerait le comportement du moteur sans que
 * personne l&apos;ait vue passer. Passer en automatique tiendra en une ligne le
 * jour où une métrique aura fait ses observations.
 */
function Proposition({ proposition }: { proposition: EtatMoteur["proposition"] }) {
  if (!proposition) return null;

  return (
    <div className="rounded-xl border border-info bg-info-faible p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-info">
        Ajustement proposé
      </p>
      <p className="mt-2 text-sm font-medium text-texte">{proposition.libelle}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-texte">
        {proposition.valeurAvant} &rarr; {proposition.valeurApres}
      </p>
      <p className="mt-3 text-sm text-texte-attenue">{proposition.motif}</p>
      <p className="mt-2 text-xs text-texte-discret">
        Justifié par « {proposition.metrique} » sur {proposition.n} observations.
        Un seul paramètre bouge à la fois, d&apos;au plus un pas, et il ne
        rebougera pas avant la fin de sa fenêtre d&apos;observation.
      </p>
      <form action={appliquerAjustementMoteur} className="mt-4">
        <input type="hidden" name="parametre" value={proposition.parametre} />
        <Bouton type="submit">Appliquer et journaliser</Bouton>
      </form>
    </div>
  );
}

/** Les réglages effectifs — défauts du code, plus le rejeu du journal. */
function Reglages({ reglages, journal }: Pick<EtatMoteur, "reglages" | "journal">) {
  const lignes = Object.entries(reglages).map(([nom, valeur]) => {
    const parametre = PARAMETRE_PAR_NOM.get(nom as never);
    return {
      nom,
      libelle: parametre?.libelle ?? nom,
      valeur,
      defaut: parametre?.defaut,
      borne: parametre ? `${parametre.min} – ${parametre.max}` : "—",
      automatique: parametre?.metrique ?? null,
    };
  });

  return (
    <div className="rounded-xl border border-bordure bg-surface p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-texte-discret">
        Réglages effectifs
      </p>
      <p className="mt-2 text-xs text-texte-attenue">
        Les valeurs du code, plus le rejeu de {journal.length} ajustement(s)
        journalisé(s). Rien n&apos;est réécrit dans le code : le journal seul
        reconstitue n&apos;importe quel état passé.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-texte-discret">
            <tr className="border-b border-bordure">
              <th className="pb-2 font-medium">Paramètre</th>
              <th className="pb-2 font-medium">Effectif</th>
              <th className="pb-2 font-medium">Livré</th>
              <th className="pb-2 font-medium">Borne</th>
              <th className="pb-2 font-medium">Ajustement auto</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.nom} className="border-b border-bordure last:border-0">
                <td className="py-2 pr-3 text-texte">{l.libelle}</td>
                <td className="py-2 pr-3 font-medium tabular-nums text-texte">{l.valeur}</td>
                <td className="py-2 pr-3 tabular-nums text-texte-discret">{l.defaut}</td>
                <td className="py-2 pr-3 tabular-nums text-texte-discret">{l.borne}</td>
                <td className="py-2 text-texte-discret">
                  {l.automatique ?? "à la main seulement"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MetriquesMoteur({
  metriques,
  reglages,
  journal,
  proposition,
}: EtatMoteur) {
  const emises = metriques.reduce((s, m) => s + m.n + m.enAttente, 0);

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-bordure bg-surface p-5 shadow-sm">
        <p className="text-sm text-texte-attenue">
          <strong className="font-medium text-texte">
            Ce que le moteur a affirmé, confronté à ce qui s&apos;est passé.
          </strong>{" "}
          Chaque fois qu&apos;une action est proposée, le moteur inscrit ce
          qu&apos;il prédit — chances de réussite, durée attendue, rétention à
          l&apos;horizon. Ces prédictions sont ensuite rejouées contre les
          tentatives et les observations réellement enregistrées.
        </p>
        <p className="mt-3 text-sm text-texte-attenue">
          Rien n&apos;est stocké ici : les quatre métriques se recalculent à
          chaque ouverture. Une prédiction que rien n&apos;a encore tranchée
          reste <strong className="font-medium text-texte">en attente</strong>,
          jamais comptée comme fausse — sans quoi on mesurerait
          l&apos;assiduité de l&apos;utilisateur, pas la justesse du moteur.
        </p>
        {emises === 0 && (
          <p className="mt-3 text-xs text-texte-discret">
            Aucune prédiction inscrite pour l&apos;instant. La première le sera à
            la prochaine ouverture du tableau de bord.
          </p>
        )}
      </div>

      <Proposition proposition={proposition} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {metriques.map((m) => (
          <Carte key={m.nom} metrique={m} />
        ))}
      </div>

      <Reglages reglages={reglages} journal={journal} />

      <p className="text-xs text-texte-discret">
        Les constantes du modèle de prédiction n&apos;ont aucune donnée derrière
        elles : elles ont été posées pour être réfutées. Tant qu&apos;une
        métrique n&apos;a pas atteint son seuil, aucun réglage du moteur ne
        bouge.
      </p>
    </div>
  );
}
