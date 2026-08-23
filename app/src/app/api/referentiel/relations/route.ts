import { chargerContexte } from "@/lib/store/context";
import { choisirConfiguration, creerMoteur } from "@/lib/tutor/moteurs";
import type { ConfigTuteurClient } from "@/lib/tutor/cle-client";
import { envTuteur } from "@/lib/tutor/env-requete";
import { proposerRelations } from "@/lib/tutor/relations-referentiel";

/**
 * Route de proposition des relations d'une compétence.
 *
 * Réponse JSON, pas SSE : l'appel est unique et ne produit aucun texte à
 * afficher au fil de l'eau — seul l'appel d'outil compte. Un flux n'apporterait
 * qu'un état « en cours » que le bouton porte déjà.
 *
 * Le corps ne transporte que le code. Les compétences, leurs codes, leurs
 * domaines et les relations déjà déclarées sont relus côté serveur sous RLS :
 * c'est ce qui garantit que l'`enum` du schéma ne contient que des codes et des
 * domaines réellement attribués à ce compte.
 */

export const maxDuration = 300;

interface CorpsRelations {
  code?: string;
  config?: ConfigTuteurClient;
}

export async function POST(request: Request) {
  let corps: CorpsRelations;
  try {
    corps = (await request.json()) as CorpsRelations;
  } catch {
    return Response.json({ erreur: "corps-invalide" }, { status: 400 });
  }

  const code = (corps.code ?? "").trim();
  if (!code) return Response.json({ erreur: "code-absent" }, { status: 400 });

  const ctx = await chargerContexte();
  const skill = ctx.referentiel.parCode.get(code);
  if (!skill || skill.archive) {
    return Response.json(
      {
        erreur: "competence-introuvable",
        message: "Cette compétence n'est pas au référentiel actif.",
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
            ? `${choix.raison} Les relations restent modifiables depuis la révision du domaine.`
            : "Aucun moteur de tuteur disponible.",
      },
      { status: 503 },
    );
  }

  const abandon = new AbortController();
  request.signal.addEventListener("abort", () => abandon.abort(), { once: true });

  try {
    const resultat = await proposerRelations(
      moteur,
      {
        skill,
        domaineNom: ctx.referentiel.domainesParId.get(skill.domaine)?.nom ?? skill.domaine,
        actifs: ctx.referentiel.actifs,
        /* Un domaine archivé n'accueille rien : le proposer serait proposer une impasse. */
        domaines: ctx.referentiel.domaines
          .filter((domaine) => !domaine.archive)
          .map((domaine) => ({ id: domaine.id, nom: domaine.nom })),
        suivantes: ctx.referentiel.actifs
          .filter((candidat) => candidat.prerequis.includes(skill.code))
          .map((candidat) => candidat.code),
      },
      abandon.signal,
    );

    if (resultat.erreur) {
      return Response.json({ erreur: "sans-proposition", message: resultat.erreur }, { status: 502 });
    }
    return Response.json({ relations: resultat.relations });
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
