"use client";

/**
 * La campagne à l'écran — ce qui survit à plusieurs tirages.
 *
 * Un parcours unique donne un point ; cet écran donne une distribution, un
 * témoin naïf en face, et l'effet mesuré du retrait de chaque sous-système.
 * Deux boîtes interquartiles qui se recouvrent sont déclarées indistinctes :
 * c'est sévère, et c'est le seul moyen de ne pas prendre un tirage chanceux
 * pour une amélioration.
 */

import { cx } from "@/components/ui/primitives";
import type { Comparaison, MesureCampagne, RapportCampagne, Serie } from "@/lib/simulation/campagne";
import { redigerConclusionCampagne } from "@/lib/simulation/export";
import { BoiteQuartiles } from "./graphiques";
import { Section } from "./briques";

const TON_COMPARAISON: Record<Comparaison, string> = {
  mieux: "text-succes",
  equivalent: "text-alerte",
  pire: "text-danger",
  indecidable: "text-texte-discret",
};

const MOT_COMPARAISON: Record<Comparaison, string> = {
  mieux: "mieux que le témoin",
  equivalent: "indistinct du témoin",
  pire: "moins bien que le témoin",
  indecidable: "pas de comparaison",
};

const MOT_ABLATION: Record<Comparaison, string> = {
  mieux: "retirer améliore",
  equivalent: "retirer ne change rien",
  pire: "retirer dégrade",
  indecidable: "indécidable",
};

function bornes(mesure: MesureCampagne): { bas: number; haut: number } {
  const series = [...mesure.parBras.map((b) => b.serie), mesure.moteur].filter(
    (s): s is Serie => s !== null,
  );
  if (series.length === 0) return { bas: 0, haut: 1 };
  return {
    bas: Math.min(...series.map((s) => s.min)),
    haut: Math.max(...series.map((s) => s.max)),
  };
}

function valeurSerie(serie: Serie | null, unite: string): string {
  if (serie === null) return "—";
  const f = (v: number) => (unite === "part" ? `${(v * 100).toFixed(0)} %` : `${v}`);
  return `${f(serie.mediane)} [${f(serie.q1)} – ${f(serie.q3)}]`;
}

export function Campagne({ rapport }: { rapport: RapportCampagne }) {
  const conclusion = redigerConclusionCampagne(rapport);
  const externes = rapport.mesures.filter((m) => m.externe);
  const internes = rapport.mesures.filter((m) => !m.externe);

  return (
    <div className="flex flex-col gap-10">
      <Section titre="Campagne — ce qui tient d'un tirage à l'autre" legende={conclusion.resume}>
        <p className="max-w-4xl text-sm text-texte-attenue">
          Chaque mesure est une médiane et son interquartile. Deux distributions qui se recouvrent
          sont déclarées indistinctes : la moitié des écarts qu&apos;on croit voir sur un parcours
          unique ne survivent pas à ce test. Seules les mesures que le moteur ne calcule pas
          lui-même — aptitude réelle, temps passé, objectifs atteints — servent d&apos;arbitre.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-texte-discret">
              <tr className="border-b border-bordure">
                <th className="py-1.5 pr-3 font-medium">Mesure externe</th>
                <th className="w-36 py-1.5 pr-3 font-medium">Moteur</th>
                <th className="w-40 py-1.5 pr-3 font-medium">Distribution</th>
                <th className="py-1.5 pr-3 font-medium">Meilleur témoin naïf</th>
                <th className="py-1.5 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {externes.map((mesure) => {
                const echelle = bornes(mesure);
                return (
                  <tr key={mesure.cle} className="border-b border-bordure last:border-0">
                    <td className="py-1.5 pr-3">
                      {mesure.libelle}
                      <span className="text-texte-discret"> ({mesure.unite})</span>
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {valeurSerie(mesure.moteur, mesure.unite)}
                    </td>
                    <td className="py-1.5 pr-3">
                      <BoiteQuartiles serie={mesure.moteur} bas={echelle.bas} haut={echelle.haut} />
                      {mesure.meilleurTemoin && (
                        <span className="mt-1 block">
                          <BoiteQuartiles
                            serie={mesure.meilleurTemoin.serie}
                            bas={echelle.bas}
                            haut={echelle.haut}
                            ton="neutre"
                          />
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      {mesure.meilleurTemoin ? (
                        <>
                          {mesure.meilleurTemoin.libelle}
                          <span className="text-texte-discret">
                            {" "}
                            {valeurSerie(mesure.meilleurTemoin.serie, mesure.unite)}
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={cx("py-1.5 font-medium", TON_COMPARAISON[mesure.face])}>
                      {MOT_COMPARAISON[mesure.face]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-texte-discret">
          Barre pleine : le moteur. Barre grise : le meilleur témoin. Trait vertical : la médiane ;
          boîte : l&apos;interquartile ; moustaches : les extrêmes.
        </p>
      </Section>

      <Section
        titre="Ce que chaque sous-système apporte"
        legende="Le moteur amputé d'une pièce, mêmes graines et mêmes archétypes. C'est ce qui nomme le fichier responsable d'un écart."
      >
        {conclusion.ablations.length === 0 ? (
          <p className="text-sm text-texte-attenue">
            Aucune ablation ne déplace une mesure au-delà du recouvrement des interquartiles : sur
            cette campagne, retirer un sous-système ne se voit pas — ce qui est déjà une information
            sur ce qu&apos;il apporte.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {conclusion.ablations.map((ablation) => (
              <li
                key={`${ablation.bras}-${ablation.mesure}`}
                className="rounded-lg border border-bordure bg-surface p-3 text-sm"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-texte">
                    {ablation.bras} — {ablation.mesure}
                  </span>
                  <span className={cx("text-xs font-semibold", TON_COMPARAISON[ablation.effet])}>
                    {MOT_ABLATION[ablation.effet]}
                  </span>
                </div>
                <p className="mt-1 text-texte-attenue">{ablation.lecture}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        titre="Constats retenus"
        legende="Un verdict n'est retenu que s'il sort du vert sur la majorité des parcours d'au moins quatre archétypes. Le reste décrit un profil, pas le moteur."
      >
        {conclusion.constatsRetenus.length === 0 ? (
          <p className="text-sm text-texte-attenue">Aucun constat ne tient sur assez de profils.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {conclusion.constatsRetenus.map((constat) => (
              <li key={constat.cle}>
                <span className="font-mono text-xs text-danger">{constat.cle}</span>{" "}
                <span className="text-texte-attenue">
                  hors du vert sur {(constat.partNonVert * 100).toFixed(0)} % des parcours ; profils
                  concernés : {constat.archetypes.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        )}

        <details className="rounded-lg border border-bordure bg-surface p-3">
          <summary className="cursor-pointer text-sm font-medium text-texte">
            Toutes les mesures, archétype par archétype
          </summary>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-texte-discret">
                <tr className="border-b border-bordure">
                  <th className="py-1.5 pr-3 font-medium">Mesure</th>
                  <th className="py-1.5 pr-3 font-medium">Moteur, tous profils</th>
                  {rapport.mesures[0]?.parArchetype.map((a) => (
                    <th key={a.archetype} className="py-1.5 pr-3 font-medium">
                      {a.libelle}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...externes, ...internes].map((mesure) => (
                  <tr key={mesure.cle} className="border-b border-bordure last:border-0">
                    <td className="py-1.5 pr-3">
                      {mesure.libelle}
                      {!mesure.externe && (
                        <span className="text-texte-discret"> — mesure interne</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3 tabular-nums">
                      {valeurSerie(mesure.moteur, mesure.unite)}
                    </td>
                    {mesure.parArchetype.map((a) => (
                      <td key={a.archetype} className="py-1.5 pr-3 tabular-nums">
                        {valeurSerie(a.serie, mesure.unite)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        <p className="max-w-4xl text-xs text-texte-discret">{conclusion.reserve}</p>
      </Section>
    </div>
  );
}
