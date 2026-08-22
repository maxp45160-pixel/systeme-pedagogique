import { chargerContexte } from "@/lib/store/context";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { envTuteur } from "@/lib/tutor/env-requete";
import { proposerTagsCompetence } from "@/lib/tutor/tags-competence";
import { chemin as cheminHierarchie } from "@/lib/domain/hierarchie-domaines";

/**
 * Route de proposition des domaines où une compétence sert (ADR-107).
 *
 * Réponse JSON, pas SSE : l'appel est unique et ne produit aucun texte à
 * afficher au fil de l'eau — seul l'appel d'outil compte.
 *
 * Le corps ne transporte que le code de la compétence. Son intitulé, son
 * palier et les domaines proposables sont relus côté serveur sous RLS : c'est
 * ce qui garantit qu'aucun compte ne fait classer la compétence d'un autre, et
 * que l'`enum` fermé est bien construit à partir du référentiel réel.
 *
 * La route ne tague rien. Elle rend une proposition ; l'écriture reste le geste
 * d'une personne, via `taguerCompetences`.
 */

export const maxDuration = 300;

interface CorpsTags {
  code?: string;
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsTags;
  try {
    corps = (await request.json()) as CorpsTags;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const code = (corps.code ?? "").trim();
  if (!code) return Response.json({ erreur: "code-absent" }, { status: 400 });

  const ctx = await chargerContexte();
  const skill = ctx.referentiel.parCode.get(code);
  if (!skill || skill.archive) {
    return Response.json(
      { erreur: "competence-introuvable", message: "Cette compétence n'est pas au référentiel actif." },
      { status: 404 },
    );
  }

  const domaines = ctx.referentiel.domaines
    .filter((domaine) => !domaine.archive)
    .map((domaine) => ({
      id: domaine.id,
      nom: domaine.nom,
      chemin: cheminHierarchie(ctx.referentiel.domaines, domaine.id)
        .map((etape) => etape.nom)
        .join(" › "),
      description: domaine.description,
    }));

  const resolution = envTuteur(corps.config);
  if (!resolution.ok) return resolution.reponse;
  const choix = choisirConfiguration(resolution.env);
  const moteur = creerMoteur(choix);
  if (!moteur) {
    return Response.json(
      {
        erreur: "moteur-absent",
        message:
          choix.kind === "aucun"
            ? `${choix.raison} Les domaines restent choisissables à la main.`
            : "Aucun moteur de tuteur disponible.",
      },
      { status: 503 },
    );
  }

  const abandon = new AbortController();
  request.signal.addEventListener("abort", () => abandon.abort(), { once: true });

  try {
    const resultat = await proposerTagsCompetence(
      moteur,
      { code: skill.code, intitule: skill.intitule, palier: skill.palier, domaines },
      skill.tagsDomaine ?? [],
      abandon.signal,
    );

    if (resultat.erreur) {
      return Response.json({ erreur: "sans-proposition", message: resultat.erreur }, { status: 502 });
    }
    /*
     * Les noms sont résolus ici, pas rendus par le modèle : l'écran ne doit
     * afficher que des domaines réels. Un `domaineId` validé existe forcément,
     * mais on ne fabrique rien si le référentiel a bougé entre-temps.
     */
    const nomsParId = new Map(domaines.map((domaine) => [domaine.id, domaine.chemin]));
    return Response.json({
      tags: resultat.tags.map((tag) => ({
        ...tag,
        chemin: nomsParId.get(tag.domaineId) ?? tag.domaineId,
      })),
      dejaPoses: resultat.dejaPoses,
    });
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
