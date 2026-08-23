"use client";

import { useMemo, useState, useTransition } from "react";
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
  type RoleCompte,
} from "@/lib/domain/acces";
import { filtrerComptes, type FiltreStatutCompte } from "@/lib/domain/admin-kpi";
import {
  changerRoleAction,
  reactiverAction,
  suspendreAction,
  type ResultatActionAcces,
} from "@/lib/store/acces-actions";

export function TableComptes({
  comptes,
  moiId,
}: {
  comptes: CompteAdministre[];
  moiId: string;
}) {
  const [recherche, setRecherche] = useState("");
  const [filtreRole, setFiltreRole] = useState<RoleCompte | "tous">("tous");
  const [filtreStatut, setFiltreStatut] = useState<FiltreStatutCompte>("tous");
  const [retour, setRetour] = useState<ResultatActionAcces | null>(null);
  const [aSuspendre, setASuspendre] = useState<CompteAdministre | null>(null);
  const [enCours, demarrer] = useTransition();

  function lancer(action: () => Promise<ResultatActionAcces>) {
    demarrer(async () => setRetour(await action()));
  }

  const comptesFiltres = useMemo(() => {
    return filtrerComptes(comptes, {
      recherche,
      role: filtreRole,
      statut: filtreStatut,
    });
  }, [comptes, recherche, filtreRole, filtreStatut]);

  return (
    <div className="space-y-4">
      {/* Barre d'outils : recherche & filtres */}
      <div className="flex flex-col gap-3 rounded-xl border border-bordure bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Rechercher par prénom, email ou identifiant..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-full rounded-lg border border-bordure bg-fond px-3.5 py-2 text-sm text-texte placeholder:text-texte-discret focus:border-primaire focus:outline-none focus:ring-1 focus:ring-primaire"
          />
          {recherche && (
            <button
              type="button"
              onClick={() => setRecherche("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-texte-discret hover:text-texte"
            >
              Effacer
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={filtreRole}
            onChange={(e) => setFiltreRole(e.target.value as RoleCompte | "tous")}
            aria-label="Filtrer par rôle"
            className="rounded-lg border border-bordure bg-fond px-3 py-2 text-xs text-texte focus:border-primaire focus:outline-none"
          >
            <option value="tous">Tous les rôles</option>
            <option value="admin">Administrateurs ({comptes.filter((c) => c.role === "admin").length})</option>
            <option value="membre">Membres ({comptes.filter((c) => c.role === "membre").length})</option>
          </select>

          <select
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value as FiltreStatutCompte)}
            aria-label="Filtrer par statut"
            className="rounded-lg border border-bordure bg-fond px-3 py-2 text-xs text-texte focus:border-primaire focus:outline-none"
          >
            <option value="tous">Tous les statuts</option>
            <option value="actifs">Actifs (ouverts)</option>
            <option value="inactifs">Inactifs (&gt; 30j / sans activité)</option>
            <option value="recents">Récents (&lt; 7j)</option>
            <option value="suspendus">Suspendus</option>
          </select>
        </div>
      </div>

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

      {comptesFiltres.length === 0 ? (
        <div className="rounded-xl border border-bordure bg-surface p-8 text-center text-sm text-texte-discret">
          Aucun compte ne correspond aux filtres appliqués.
        </div>
      ) : (
        <ul className="divide-y divide-bordure overflow-hidden rounded-xl border border-bordure bg-surface shadow-sm">
          {comptesFiltres.map((compte) => {
          const suspendu = estSuspendu(compte);
          const moi = compte.userId === moiId;
          const refusRole = refusChangementRole(
            compte,
            compte.role === "admin" ? "membre" : "admin",
            moiId,
          );
          const refusCoupure = suspendu
            ? refusReactivation(compte)
            : refusSuspension(compte, moiId);

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
                    {compte.observations} observation{compte.observations > 1 ? "s" : ""} · {compte.competences}{" "}
                    compétence{compte.competences > 1 ? "s" : ""} · {compte.exercices} exercice
                    {compte.exercices > 1 ? "s" : ""} · {compte.seances} séance
                    {compte.seances > 1 ? "s" : ""}
                    {compte.derniereActivite
                      ? ` · dernière activité ${formatDateRelative(compte.derniereActivite)}`
                      : " · aucune activité"}
                  </p>

                  {/*
                    La consommation de la clé serveur (ADR-116) — c'est d'ici
                    qu'on décide d'accorder plus à un compte, ou de couper. Un
                    administrateur n'est jamais décompté, l'afficher pour lui
                    annoncerait une limite qui n'existe pas.
                  */}
                  {compte.role !== "admin" && (
                    <p className="chiffres mt-0.5 text-[0.6875rem] text-texte-discret">
                      Tuteur : {compte.quotaAppels}/{compte.quotaMensuel} génération
                      {compte.quotaMensuel > 1 ? "s" : ""} ce mois-ci
                      {compte.quotaMensuel === 0 && " — clé serveur fermée pour ce compte"}
                    </p>
                  )}

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
      )}

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
    </div>
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
          {nom} ne pourra plus lire son référentiel, ses observations, ses exercices ni ses documents
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
