import { chargerContexte } from "@/lib/store/context";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { envTuteur } from "@/lib/tutor/env-requete";
import { proposerRattachementCarte } from "@/lib/tutor/rattachement-carte";
import { sousArbre } from "@/lib/domain/hierarchie-domaines";

/**
 * Route de proposition d'une position sur la carte des savoirs.
 *
 * Réponse JSON, pas SSE : l'appel est unique et ne produit aucun texte à
 * afficher au fil de l'eau — seul l'appel d'outil compte.
 *
 * Le corps ne transporte que l'identifiant du domaine. Son nom, sa description
 * et les intitulés de ses compétences sont relus côté serveur sous RLS : c'est
 * ce qui garantit qu'aucun compte ne fait situer le domaine d'un autre.
 *
 * La route ne rattache rien. Elle rend une proposition ; l'écriture reste le
 * geste d'une personne, via `rattacherDomaineACarte`.
 */

export const maxDuration = 300;

interface CorpsCarte {
  domaineId?: string;
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsCarte;
  try {
    corps = (await request.json()) as CorpsCarte;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const domaineId = (corps.domaineId ?? "").trim();
  if (!domaineId) return Response.json({ erreur: "domaine-absent" }, { status: 400 });

  const ctx = await chargerContexte();
  const domaine = ctx.referentiel.domainesParId.get(domaineId);
  if (!domaine || domaine.archive) {
    return Response.json(
      {
        erreur: "domaine-introuvable",
        message: "Ce domaine n'est pas au référentiel actif.",
      },
      { status: 404 },
    );
  }

  const resolution = await envTuteur(corps.config);
  if (!resolution.ok) return resolution.reponse;
  const choix = choisirConfiguration(resolution.env);
  const moteur = creerMoteur(choix);

  if (!moteur) {
    return Response.json(
      {
        erreur: "moteur-absent",
        message:
          choix.kind === "aucun"
            ? `${choix.raison} La position reste choisissable à la main dans la liste.`
            : "Aucun moteur de tuteur disponible.",
      },
      { status: 503 },
    );
  }

  const abandon = new AbortController();
  request.signal.addEventListener("abort", () => abandon.abort(), { once: true });

  const perimetre = sousArbre(ctx.referentiel.domaines, domaineId);

  try {
    const resultat = await proposerRattachementCarte(
      moteur,
      {
        domaineId,
        nom: domaine.nom,
        description: domaine.description,
        /*
         * Toutes les compétences du sous-arbre (ADR-107) : une compétence
         * partagée décrit ce domaine autant que celles qui n'y servent qu'ici,
         * et un sous-domaine décrit son parent.
         */
        intitules: ctx.referentiel.actifs
          .filter((skill) => (skill.tagsDomaine ?? []).some((tag) => perimetre.has(tag)))
          .map((skill) => skill.intitule),
      },
      abandon.signal,
    );

    if (resultat.erreur) {
      return Response.json({ erreur: "sans-proposition", message: resultat.erreur }, { status: 502 });
    }
    return Response.json({ carte: resultat.carte, chemin: resultat.chemin });
  } catch (e) {
    if (abandon.signal.aborted) return new Response(null, { status: 499 });
    return Response.json(
      {
        erreur: "echec",
        message: e instanceof Error ? e.message : "Erreur inattendue pendant la proposition.",
      },
      { status: 500 },
    );
  }
}
