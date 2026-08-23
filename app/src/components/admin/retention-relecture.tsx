import { Carte, EtatVide, TitreSection } from "@/components/ui/primitives";
import {
  LOTS_AVANT_VERDICT,
  type LectureRefutation,
  type VerdictCritere,
} from "@/lib/domain/propositions-referentiel";

/**
 * Le taux de rétention de la relecture du référentiel — ADR-108.
 *
 * ## Pourquoi ici, et nulle part ailleurs
 *
 * ADR-108 en fait la condition de son propre test : « mesure préalable
 * indispensable : le taux de rétention par genre. Sans lui, ce test n'est pas
 * exécutable. » Elle était calculable et affichée nulle part — le même défaut
 * que celui de l'ADR elle-même, qui avait construit six détecteurs sans
 * surface pour les lire.
 *
 * Mais elle n'a pas sa place dans l'application. Les genres — `arete`,
 * `dormance`, `reformulation`, `rangement`, `scission`, `relation`, `manque` —
 * sont du vocabulaire de maintenance, et une personne qui vient travailler ses
 * compétences n'a pas à l'apprendre. `/admin` est la seule surface du dépôt
 * déjà réservée à cet usage : le jargon y est chez lui.
 *
 * ## Ce qui n'est pas affiché
 *
 * Aucun verdict que les données ne portent pas. Trois lots sont demandés par
 * l'ADR avant de conclure ; en dessous, chaque critère le dit plutôt que de
 * rendre un « tenu » qui ne refléterait que l'enthousiasme d'une première
 * découverte de l'écran. C'est P2 appliqué à la mesure d'elle-même.
 */

const APPARENCE_VERDICT: Record<
  VerdictCritere,
  { libelle: string; classe: string }
> = {
  tenu: { libelle: "Tenu", classe: "border-primaire/40 bg-primaire-faible text-primaire" },
  refute: { libelle: "Réfuté", classe: "border-danger/30 bg-danger-faible text-danger" },
  insuffisant: {
    libelle: "Données insuffisantes",
    classe: "border-bordure bg-surface-2 text-texte-attenue",
  },
  "non-mesurable": {
    libelle: "Non mesurable",
    classe: "border-bordure bg-surface-2 text-texte-discret",
  },
};

/** Les genres, dans l'ordre où ADR-108 les présente. */
const ORIGINE_GENRE: Record<string, string> = {
  arete: "déterministe",
  dormance: "déterministe",
  reformulation: "déterministe",
  rangement: "déterministe",
  scission: "tuteur",
  relation: "tuteur",
  manque: "tuteur",
};

function pourcent(taux: number | null): string {
  return taux === null ? "—" : `${Math.round(taux * 100)} %`;
}

export function RetentionRelecture({ lecture }: { lecture: LectureRefutation }) {
  const { lots, retention, ensemble, criteres } = lecture;

  if (ensemble.proposees === 0) {
    return (
      <Carte>
        <EtatVide
          titre="Aucune relecture n'a encore produit de proposition"
          message="Le taux de rétention se calcule dès le premier lot arbitré. Il n'invente rien tant qu'il n'a rien à lire."
        />
      </Carte>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <TitreSection
          legende={`${lots} lot${lots > 1 ? "s" : ""} produit${lots > 1 ? "s" : ""} — ADR-108 en demande ${LOTS_AVANT_VERDICT} avant de conclure.`}
        >
          Rétention par genre
        </TitreSection>

        <Carte className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-bordure text-texte-attenue">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Genre</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Origine</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Proposées</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Arbitrées</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Retenues</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Taux</th>
              </tr>
            </thead>
            <tbody>
              {retention.map((ligne) => (
                <tr key={ligne.genre} className="border-b border-bordure/50 last:border-0">
                  <td className="px-4 py-2 font-mono">{ligne.genre}</td>
                  <td className="px-4 py-2 text-texte-discret">{ORIGINE_GENRE[ligne.genre]}</td>
                  <td className="px-4 py-2 text-right chiffres">{ligne.proposees}</td>
                  <td className="px-4 py-2 text-right chiffres">{ligne.arbitrees}</td>
                  <td className="px-4 py-2 text-right chiffres">{ligne.retenues}</td>
                  {/*
                    Un tiret, pas un « 0 % », quand rien n'a été arbitré : un
                    zéro se lirait comme « jamais retenu » là où la vérité est
                    « pas encore regardé ».
                  */}
                  <td className="px-4 py-2 text-right chiffres font-medium">
                    {pourcent(ligne.taux)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-bordure font-medium">
                <td className="px-4 py-2.5" colSpan={2}>Ensemble</td>
                <td className="px-4 py-2.5 text-right chiffres">{ensemble.proposees}</td>
                <td className="px-4 py-2.5 text-right chiffres">{ensemble.arbitrees}</td>
                <td className="px-4 py-2.5 text-right chiffres">{ensemble.retenues}</td>
                <td className="px-4 py-2.5 text-right chiffres">{pourcent(ensemble.taux)}</td>
              </tr>
            </tbody>
          </table>
        </Carte>
      </section>

      <section>
        <TitreSection legende="Les trois critères du test de réfutation, confrontés aux faits enregistrés.">
          Test de réfutation d&apos;ADR-108
        </TitreSection>

        <div className="space-y-3">
          {criteres.map((critere) => {
            const apparence = APPARENCE_VERDICT[critere.verdict];
            return (
              <Carte key={critere.enonce} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="max-w-2xl text-xs leading-relaxed text-texte-attenue">
                    {critere.enonce}
                  </p>
                  <span
                    className={`shrink-0 rounded-md border px-2 py-0.5 text-[0.6875rem] font-medium ${apparence.classe}`}
                  >
                    {apparence.libelle}
                  </span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-texte">{critere.constat}</p>
              </Carte>
            );
          })}
        </div>
      </section>

      <p className="text-[0.6875rem] leading-relaxed text-texte-discret">
        Rien de ceci n&apos;est stocké : tout se recalcule à la lecture depuis les
        arbitrages enregistrés. Aucun statut ne monte d&apos;ici — ADR-108 reste
        une question ouverte tant qu&apos;une personne ne la tranche pas.
      </p>
    </div>
  );
}
