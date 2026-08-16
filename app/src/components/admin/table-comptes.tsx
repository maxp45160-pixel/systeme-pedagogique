"use client";

import { useState, useTransition } from "react";
import { Modale } from "@/components/ui/modale";
import { Champ } from "@/components/ui/champ";
import { Bouton, Etiquette, cx } from "@/components/ui/primitives";
import { formatDateRelative } from "@/lib/engine/dates";
import {
  LIBELLES_ROLE,
  MOTIF_MAX,
  estSuspendu,
  refusChangementRole,
  refusReactivation,
  refusSuspension,
  type CompteAdministre,
} from "@/lib/domain/acces";
import {
  changerRoleAction,
  reactiverAction,
  suspendreAction,
  type ResultatActionAcces,
} from "@/lib/store/acces-actions";

/**
 * La liste des comptes, et les trois gestes qu'on peut poser dessus.
 *
 * Chaque bouton interdit est **désactivé avec sa raison en infobulle**, jamais
 * simplement absent : « pourquoi ne puis-je pas retirer ce rôle » est une
 * question que l'écran doit savoir répondre. Les mêmes règles sont tenues par
 * un trigger PostgreSQL — ce qui est affiché ici est une politesse, ce qui est
 * appliqué là-bas est la garantie.
 *
 * Le retour de chaque action est affiché tel quel, y compris quand la base
 * refuse : le message vient d'elle, et le retraduire ferait deux formulations
 * d'une même règle.
 */
export function TableComptes({
  comptes,
  moiId,
}: {
  comptes: CompteAdministre[];
  moiId: string;
}) {
  const [retour, setRetour] = useState<ResultatActionAcces | null>(null);
  const [aSuspendre, setASuspendre] = useState<CompteAdministre | null>(null);
  const [enCours, demarrer] = useTransition();

  function lancer(action: () => Promise<ResultatActionAcces>) {
    demarrer(async () => setRetour(await action()));
  }

  return (
    <>
      {retour && (
        <p
          role="status"
          className={cx(
            "rounded-lg px-3 py-2 text-xs",
            retour.ok ? "bg-succes-faible text-succes" : "bg-danger-faible text-danger",
          )}
        >
          {retour.message}
        </p>
      )}

      <ul className="divide-y divide-bordure overflow-hidden rounded-xl border border-bordure bg-surface">
        {comptes.map((compte) => {
          const suspendu = estSuspendu(compte);
          const moi = compte.userId === moiId;
          const refusRole = refusChangementRole(
            compte,
            compte.role === "admin" ? "membre" : "admin",
            moiId,
            comptes,
          );
          const refusCoupure = suspendu
            ? refusReactivation(compte)
            : refusSuspension(compte, moiId, comptes);

          return (
            <li key={compte.userId} className="px-4 py-3.5 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-medium">
                      {compte.prenom || compte.email || "Compte sans profil"}
                    </span>
                    {compte.role === "admin" && <Etiquette ton="info">Administrateur</Etiquette>}
                    {suspendu && <Etiquette ton="alerte">Suspendu</Etiquette>}
                    {moi && <Etiquette ton="neutre">Toi</Etiquette>}
                  </div>

                  <p className="mt-0.5 truncate text-xs text-texte-attenue">
                    {compte.email ?? "courriel inconnu"}
                  </p>

                  {/*
                    Des compteurs, pas du contenu : cet écran dit combien, il ne
                    dit jamais quoi.
                  */}
                  <p className="chiffres mt-1 text-[0.6875rem] text-texte-discret">
                    {compte.preuves} preuve{compte.preuves > 1 ? "s" : ""} · {compte.competences}{" "}
                    compétence{compte.competences > 1 ? "s" : ""} · {compte.exercices} exercice
                    {compte.exercices > 1 ? "s" : ""} · {compte.seances} séance
                    {compte.seances > 1 ? "s" : ""}
                    {compte.derniereActivite
                      ? ` · dernière activité ${formatDateRelative(compte.derniereActivite)}`
                      : " · aucune activité"}
                  </p>

                  {suspendu && (
                    <p className="mt-1 text-[0.6875rem] text-alerte">
                      Suspendu {compte.suspenduLe ? formatDateRelative(compte.suspenduLe) : ""}
                      {compte.motif ? ` — ${compte.motif}` : " — sans motif consigné"}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Bouton
                    taille="petite"
                    variante="secondaire"
                    disabled={enCours || refusRole !== null}
                    title={refusRole ?? undefined}
                    onClick={() =>
                      lancer(() =>
                        changerRoleAction(
                          compte.userId,
                          compte.role === "admin" ? "membre" : "admin",
                        ),
                      )
                    }
                  >
                    {compte.role === "admin"
                      ? `Ramener à ${LIBELLES_ROLE.membre.toLowerCase()}`
                      : `Passer ${LIBELLES_ROLE.admin.toLowerCase()}`}
                  </Bouton>

                  <Bouton
                    taille="petite"
                    variante={suspendu ? "principal" : "danger"}
                    disabled={enCours || refusCoupure !== null}
                    title={refusCoupure ?? undefined}
                    onClick={() =>
                      suspendu
                        ? lancer(() => reactiverAction(compte.userId))
                        : setASuspendre(compte)
                    }
                  >
                    {suspendu ? "Rouvrir l'accès" : "Suspendre"}
                  </Bouton>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {aSuspendre && (
        <ModaleSuspension
          compte={aSuspendre}
          enCours={enCours}
          onFermer={() => setASuspendre(null)}
          onConfirmer={(motif) => {
            const cible = aSuspendre.userId;
            setASuspendre(null);
            lancer(() => suspendreAction(cible, motif));
          }}
        />
      )}
    </>
  );
}

/**
 * La confirmation de suspension.
 *
 * Le motif est facultatif mais demandé : trois mois plus tard, « suspendu le 16
 * août » sans raison est une décision qu'on ne sait plus relire. Il est stocké
 * en clair et visible du compte concerné — c'est ce qui lui sera montré.
 */
function ModaleSuspension({
  compte,
  enCours,
  onFermer,
  onConfirmer,
}: {
  compte: CompteAdministre;
  enCours: boolean;
  onFermer: () => void;
  onConfirmer: (motif: string) => void;
}) {
  const [motif, setMotif] = useState("");
  const nom = compte.prenom || compte.email || "ce compte";

  return (
    <Modale
      titre={`Suspendre ${nom} ?`}
      sousTitre="L'accès est coupé par la base, immédiatement. Aucune donnée n'est supprimée."
      largeur="xl"
      onFermer={onFermer}
      pied={
        <>
          <Bouton variante="secondaire" onClick={onFermer}>
            Annuler
          </Bouton>
          <Bouton variante="danger" enChargement={enCours} onClick={() => onConfirmer(motif)}>
            Suspendre l&apos;accès
          </Bouton>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-texte-attenue">
          {nom} ne pourra plus lire son référentiel, ses preuves, ses exercices ni ses documents
          tant que l&apos;accès reste fermé. Tout revient en l&apos;état à la réouverture.
        </p>
        <Champ
          label="Motif"
          multiligne
          rows={2}
          maxLength={MOTIF_MAX}
          value={motif}
          onChange={(event) => setMotif(event.target.value)}
          aide="Facultatif, mais lisible par la personne concernée."
          placeholder="Ex. compte de test, à rouvrir après la démo"
          autoFocus
        />
      </div>
    </Modale>
  );
}
