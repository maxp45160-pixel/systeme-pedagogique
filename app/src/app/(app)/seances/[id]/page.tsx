import Link from "next/link";
import { notFound } from "next/navigation";
import { chargerContexte } from "@/lib/store/context";
import {
  demarrerSeance,
  terminerSeance,
  annulerSeance,
} from "@/lib/store/seance-actions";
import {
  avancementSeance,
  ecartBesoinRealise,
  statutSeance,
} from "@/lib/domain/seance";
import { formatDateCourte, formatDuree } from "@/lib/engine/dates";
import { Bouton, Carte, CodeCompetence, EnTeteCarte, Etiquette, EtatVide } from "@/components/ui/primitives";

const LIBELLES_STATUT: Record<"planifiee" | "en-cours" | "terminee", { texte: string; ton: "info" | "primaire" | "succes" }> = {
  planifiee: { texte: "Planifiée", ton: "info" },
  "en-cours": { texte: "En cours", ton: "primaire" },
  terminee: { texte: "Terminée", ton: "succes" },
};

/**
 * Déroulé d'une séance (lot 2.3).
 *
 * Chaque exercice ouvre l'écran unitaire existant, sans modification du
 * process ; au retour, l'avancement se re-dérive des tentatives. Le bilan
 * affiche l'écart besoin/réalisé (`ecartBesoinRealise`) avec les deux valeurs
 * et leurs sources — aucun indice sur la personne (D6).
 */
export default async function PageSeance({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await chargerContexte();

  const seance = ctx.donnees.sessions.find((s) => s.id === id);
  if (!seance) notFound();

  const statut = statutSeance(seance);
  const tentatives = ctx.donnees.attempts;
  const avancement = avancementSeance(seance, tentatives);

  const parId = new Map(ctx.donnees.exercises.map((e) => [e.id, e]));
  const competencesParExercice = new Map(ctx.donnees.exercises.map((e) => [e.id, e.competences]));
  const ecart = ecartBesoinRealise(seance, tentatives, competencesParExercice);

  const etatDe = (ref: string): "menes" | "enCours" | "abandonnes" | "restants" => {
    if (avancement.menes.includes(ref)) return "menes";
    if (avancement.enCours.includes(ref)) return "enCours";
    if (avancement.abandonnes.includes(ref)) return "abandonnes";
    return "restants";
  };

  const ACTIVITES = seance.activites.filter((a) => a.type === "exercice");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-texte-discret">
            {seance.planifieePour
              ? `Prévue le ${formatDateCourte(seance.planifieePour)}`
              : `Séance du ${formatDateCourte(seance.date)}`}
          </p>
          <h1 className="font-serif text-lg font-medium">
            {LIBELLES_STATUT[statut].texte}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {statut === "planifiee" && (
            <>
              <form action={annulerSeance.bind(null, seance.id)}>
                <Bouton type="submit" variante="danger">Annuler</Bouton>
              </form>
              <form action={demarrerSeance.bind(null, seance.id)}>
                <Bouton type="submit" variante="principal">Démarrer</Bouton>
              </form>
            </>
          )}
          {statut === "en-cours" && (
            <form action={terminerSeance.bind(null, seance.id)}>
              <Bouton type="submit" variante="principal">Terminer la séance</Bouton>
            </form>
          )}
        </div>
      </div>

      {seance.besoinDeclare && (
        <Carte>
          <EnTeteCarte titre="Besoin déclaré" />
          <div className="px-5 py-4">
            <p className="text-sm italic">« {seance.besoinDeclare.intention} »</p>
            <p className="mt-1 text-xs text-texte-attenue">
              {seance.besoinDeclare.codesVises.length} compétence(s) visée(s) ·{" "}
              {seance.besoinDeclare.tempsDisponibleMin} min déclarées · déclaré le{" "}
              {formatDateCourte(seance.besoinDeclare.declareLe)}
            </p>
          </div>
        </Carte>
      )}
<Carte>
        <EnTeteCarte
          titre="Activités"
          legende={`${avancement.menes.length} mené${avancement.menes.length > 1 ? "s" : ""} sur ${avancement.total}`}
        />
        {ACTIVITES.length === 0 ? (
          <div className="px-5 py-6">
            <EtatVide
              titre="Aucune activité"
              message="Cette séance n'a pas encore d'exercices retenus."
            />
          </div>
        ) : (
          <ul className="divide-y divide-bordure">
            {ACTIVITES.map((a) => {
              const exercice = parId.get(a.ref);
              const etat = etatDe(a.ref);
              return (
                <li key={a.ref} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="min-w-0">
                    <Link
                      href={`/exercices/${a.ref}`}
                      className="text-sm font-medium text-primaire hover:underline"
                    >
                      {a.libelle}
                    </Link>
                    {exercice && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.6875rem] text-texte-discret">
                        {exercice.competences.map((c) => (
                          <CodeCompetence key={c} code={c} />
                        ))}
                        <span>· Difficulté {exercice.difficulte}/5</span>
                        <span>· ≈ {formatDuree(exercice.dureeEstimeeMin)}</span>
                      </div>
                    )}
                  </div>
                  <Etiquette ton={ETAT_ACTIVITE[etat].ton}>
                    {ETAT_ACTIVITE[etat].texte}
                  </Etiquette>
                </li>
              );
            })}
          </ul>
        )}
      </Carte>

      {statut === "terminee" && ecart && (
        <Carte>
          <EnTeteCarte titre="Écart besoin / réalisé" />
          <div className="space-y-3 px-5 py-4">
            {ecart.constats.map((c, i) => (
              <p key={i} className="text-xs text-texte-attenue">{c}</p>
            ))}
            {ecart.reserves.length > 0 && (
              <div className="space-y-1 border-t border-bordure pt-2">
                {ecart.reserves.map((r, i) => (
                  <p key={i} className="text-[0.6875rem] text-texte-discret">{r}</p>
                ))}
              </div>
            )}
          </div>
        </Carte>
      )}
    </div>
  );
}

const ETAT_ACTIVITE: Record<"menes" | "enCours" | "abandonnes" | "restants", { texte: string; ton?: "succes" | "primaire" | "info" | "danger" }> = {
  menes: { texte: "Mené", ton: "succes" },
  enCours: { texte: "En cours", ton: "primaire" },
  abandonnes: { texte: "Abandonné", ton: "danger" },
  restants: { texte: "À faire" },
};