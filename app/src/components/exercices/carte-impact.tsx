import Link from "next/link";
import type { CompetenceRenforcee, ImpactTravail } from "@/lib/engine/impact";
import {
  Carte,
  CodeCompetence,
  Etiquette,
  JaugeNiveau,
  TagConfiance,
  classesLienBouton,
  cx,
} from "@/components/ui/primitives";
import { IconeValide } from "@/components/ui/icones";
import { formatDuree } from "@/lib/engine/dates";

/**
 * « Je vois exactement ce que ce travail vient d'ajouter. »
 *
 * Cette carte remplace le bandeau « Preuve enregistrée — niveau 3/5, confiance
 * moyenne », qui donnait deux nombres sans dire ce qu'ils étaient avant.
 *
 * Elle n'affiche **que** ce que `impactTentative` a dérivé : aucune valeur n'est
 * recalculée ici, aucune phrase n'est écrite ici. Un composant qui reformulerait
 * une mesure serait un second endroit où la règle vit — et c'est le second
 * endroit qui finit par mentir.
 */
export function CarteImpact({
  impact,
  titre = "Ce que ce travail vient d'ajouter",
  actions,
  lienCompetence = true,
}: {
  impact: ImpactTravail;
  titre?: string;
  actions?: React.ReactNode;
  /** Les fiches sont dans l'Atelier ; un workspace intégré n'y renvoie pas. */
  lienCompetence?: boolean;
}) {
  const { travail, renforcees, observations, consequences, aRetravailler } = impact;

  return (
    <Carte accent className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 bg-succes" aria-hidden />
      <div className="space-y-5 px-5 py-5 sm:px-6">
        <div>
          <p className="flex items-center gap-1.5 text-[0.6875rem] font-semibold uppercase tracking-wider text-succes">
            <IconeValide className="size-3.5" />
            {titre}
          </p>
          {/*
            La difficulté ne s'affiche que si elle en est une : une séance
            agrège plusieurs exercices et n'a pas de difficulté propre. Écrire
            « difficulté 0/5 » inventerait une mesure là où il n'y en a pas.
          */}
          <p className="mt-1.5 text-sm text-texte-attenue">
            {travail.titre}
            {travail.dureeMin !== null && travail.dureeMin > 0 && ` · ${formatDuree(travail.dureeMin)}`}
            {travail.difficulte > 0 && ` · difficulté ${travail.difficulte}/5`}
          </p>
        </div>

        {renforcees.length > 0 && (
          <section>
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
              Compétences travaillées
            </h3>
            <ul className="mt-2.5 space-y-2">
              {renforcees.map((competence) => (
                <li key={competence.code}>
                  <LigneCompetence competence={competence} lien={lienCompetence} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {consequences.length > 0 && (
          <section>
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
              Ce que ça change
            </h3>
            <ul className="mt-2 space-y-1">
              {consequences.map((ligne) => (
                <li key={ligne} className="flex gap-2 text-xs leading-relaxed text-texte-attenue">
                  <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-succes" />
                  <span>{ligne}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {observations.length > 0 && (
          <section>
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
              Ce qui a été observé
            </h3>
            <ul className="mt-2 space-y-1">
              {observations.map((ligne) => (
                <li key={ligne} className="flex gap-2 text-xs leading-relaxed text-texte-attenue">
                  <span aria-hidden className="mt-1.5 size-1 shrink-0 rounded-full bg-bordure-contraste" />
                  <span>{ligne}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/*
          Le conseil du tuteur reste à part, et nommé.
          Mêlé aux conséquences, il se lirait comme une mesure — or il n'en est
          pas une (P5). Il est repris mot pour mot depuis le verdict archivé.
        */}
        {aRetravailler.length > 0 && (
          <section className="rounded-lg border border-bordure bg-surface-2 px-3 py-2.5">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
              À retravailler — d&apos;après le tuteur
            </h3>
            <ul className="mt-1.5 space-y-0.5">
              {aRetravailler.map((ligne) => (
                <li key={ligne} className="text-xs leading-relaxed text-texte-attenue">
                  · {ligne}
                </li>
              ))}
            </ul>
          </section>
        )}

        {actions && <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>}
      </div>
    </Carte>
  );
}

/**
 * Une compétence, son avant et son après.
 *
 * Le niveau inchangé s'écrit aussi — « reste à 3 » — plutôt que de disparaître.
 * N'afficher que les franchissements donnerait l'illusion d'une courbe toujours
 * montante, et ferait passer une séance de consolidation pour du temps perdu.
 */
function LigneCompetence({
  competence,
  lien,
}: {
  competence: CompetenceRenforcee;
  lien: boolean;
}) {
  const contenu = (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <CodeCompetence code={competence.code} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">{competence.intitule}</span>
        {competence.niveauPreuve === "B" && (
          <Etiquette>Preuve indirecte</Etiquette>
        )}
        {competence.franchissement && <Etiquette ton="succes">Palier franchi</Etiquette>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.6875rem]">
        <span className="flex items-center gap-1.5">
          <span className="text-texte-discret">Niveau</span>
          <span className="chiffres text-texte-attenue">{competence.niveauAvant ?? "—"}</span>
          <span aria-hidden className="text-texte-discret">→</span>
          <span
            className={cx(
              "chiffres font-semibold",
              competence.franchissement ? "text-succes" : "text-texte",
            )}
          >
            {competence.niveauApres ?? "—"}
          </span>
          <span className="w-12">
            <JaugeNiveau niveau={competence.niveauApres} taille="compacte" />
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="text-texte-discret">Confiance</span>
          <TagConfiance confiance={competence.confianceApres} />
        </span>
        <span className="text-texte-discret">
          {competence.nombrePreuves} preuve{competence.nombrePreuves > 1 ? "s" : ""}
        </span>
      </div>
    </>
  );

  const classes = "block rounded-lg border border-bordure bg-surface px-3 py-2.5";
  return lien ? (
    <Link
      href={`/atelier?document=${encodeURIComponent(competence.code)}`}
      className={`${classes} transition-colors hover:border-primaire/40 hover:bg-surface-2`}
    >
      {contenu}
    </Link>
  ) : (
    <div className={classes}>{contenu}</div>
  );
}

/** Le bouton principal des cartes d'impact — même style partout. */
export function LienApresImpact({ href, libelle }: { href: string; libelle: string }) {
  return (
    <Link href={href} className={classesLienBouton("principal", "normale")}>
      <span>{libelle}</span>
      <span aria-hidden className="ml-1">→</span>
    </Link>
  );
}
