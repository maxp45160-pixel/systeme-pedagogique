"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Bouton, SelecteurSegmente, cx } from "@/components/ui/primitives";
import { seDeconnecter } from "@/lib/supabase/actions";
import { exporterJournal } from "@/lib/store/export";
import {
  IconeAmpoule,
  IconeCle,
  IconeDocuments,
  IconeTheme,
  IconeValide,
} from "@/components/ui/icones";
import { FormulaireProfil } from "@/components/profil/formulaire-profil";
import { ModaleDangerCompte } from "@/components/layout/modale-danger-compte";
import { appliquerTheme, lireChoixTheme, type ChoixTheme } from "@/components/layout/theme";
import type { User } from "@/lib/domain/types";
import { ReglagesTuteur } from "@/components/tuteur/reglages-tuteur";
import type { OngletCompte } from "@/lib/domain/onglets-compte";

interface OngletDef {
  id: OngletCompte;
  libelle: string;
  icone: ComponentType<{ className?: string }>;
}

const ONGLETS: OngletDef[] = [
  { id: "profil", libelle: "Profil d'apprentissage", icone: IconeAmpoule },
  { id: "tuteur", libelle: "Tuteur IA & Clé", icone: IconeCle },
  { id: "preferences", libelle: "Apparence & Compte", icone: IconeTheme },
  { id: "donnees", libelle: "Sauvegarde & Données", icone: IconeDocuments },
];

export function PanneauCompte({
  profil,
  compteId,
  courriel,
  ongletInitial,
  retour,
}: {
  profil: User;
  compteId: string;
  courriel: string | null;
  /** Onglet demandé par l'URL (`?onglet=`) — déjà validé côté serveur. */
  ongletInitial?: OngletCompte;
  /**
   * Chemin interne vers lequel revenir après l'enregistrement d'une clé
   * (`?retour=`) — déjà validé côté serveur. Sans lui, l'enregistrement
   * reste sur place.
   */
  retour?: string;
}) {
  const [onglet, setOnglet] = useState<OngletCompte>(ongletInitial ?? "profil");
  const router = useRouter();
  const [exportEnCours, setExportEnCours] = useState(false);
  const [messageExport, setMessageExport] = useState<string | null>(null);
  const [modaleDangerOuverte, setModaleDangerOuverte] = useState(false);

  async function telechargerArchive() {
    setExportEnCours(true);
    setMessageExport(null);
    try {
      const archive = await exporterJournal();
      const total = Object.values(archive.effectifs).reduce((s, n) => s + n, 0);

      const lien = document.createElement("a");
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(archive, null, 2)], { type: "application/json" }),
      );
      lien.href = url;
      lien.download = `journal-${archive.exporteLe.slice(0, 10)}.json`;
      lien.click();
      URL.revokeObjectURL(url);

      setMessageExport(`Archive téléchargée — ${total} enregistrement(s).`);
    } catch (erreur) {
      setMessageExport(erreur instanceof Error ? erreur.message : "Échec de l'export.");
    } finally {
      setExportEnCours(false);
    }
  }

  const nonRenseigne = (v?: string) => (!v || v.includes("à renseigner") ? "" : v);

  return (
    <div className="space-y-6">
      {/* Barre d'onglets stylée en pastilles segmentées */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-bordure bg-surface-2/50 p-1.5 shadow-xs">
        {ONGLETS.map((tab) => {
          const Icone = tab.icone;
          const estActif = onglet === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setOnglet(tab.id)}
              className={cx(
                "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all cursor-pointer",
                estActif
                  ? "bg-surface text-texte font-semibold shadow-xs border border-bordure/80"
                  : "text-texte-attenue hover:text-texte hover:bg-surface/50",
              )}
              aria-pressed={estActif}
            >
              <Icone
                className={cx(
                  "size-3.5 shrink-0",
                  estActif ? "text-primaire" : "text-texte-discret",
                )}
              />
              <span>{tab.libelle}</span>
            </button>
          );
        })}
      </div>

      {/* Surface principale avec contenu élégant */}
      <div className="rounded-2xl border border-bordure bg-surface p-5 sm:p-7 shadow-xs">
        {onglet === "profil" && (
          <FormulaireProfil
            formation={nonRenseigne(profil.formation)}
            preferencesPedagogiques={profil.preferencesPedagogiques ?? []}
          />
        )}

        {onglet === "tuteur" && (
          <div className="space-y-5">
            <div className="border-b border-bordure/60 pb-3.5">
              <h3 className="text-sm font-semibold text-texte">Configuration du Tuteur IA</h3>
              <p className="text-xs text-texte-attenue mt-0.5">
                Renseignez votre clé d&apos;API pour la génération d&apos;exercices et l&apos;aide en direct.
                Elle est stockée localement dans votre navigateur et n&apos;est jamais partagée.
              </p>
            </div>
            <div className="max-w-xl">
              <ReglagesTuteur
                compteId={compteId}
                surEnregistre={
                  retour
                    ? () => {
                        // La clé est enregistrée dans ce navigateur : on rend
                        // à l'utilisateur l'endroit exact où il bloquait.
                        router.push(retour);
                      }
                    : undefined
                }
              />
            </div>
          </div>
        )}

        {onglet === "preferences" && (
          <div className="space-y-6 divide-y divide-bordure/60">
            {/* Ligne 1 : Thème */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
              <div className="space-y-0.5">
                <h4 className="text-sm font-semibold text-texte">Thème d&apos;affichage</h4>
                <p className="text-xs text-texte-attenue">
                  Basculez entre le mode clair, sombre ou suivez automatiquement les réglages système.
                </p>
              </div>
              <div className="shrink-0">
                <ChoixApparence />
              </div>
            </div>

            {/* Ligne 2 : Identité & Session */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6">
              <div className="flex items-center gap-3.5 min-w-0">
                {profil.avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={profil.avatarUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="size-11 shrink-0 rounded-full border border-bordure object-cover shadow-xs"
                  />
                ) : (
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primaire text-sm font-semibold text-primaire-contraste shadow-xs">
                    {profil.prenom?.charAt(0).toUpperCase() || "C"}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-texte">
                    {profil.prenom || "Compte"}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-texte-attenue">
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-succes" />
                    <span className="truncate">{courriel ?? "compte sans courriel"}</span>
                  </div>
                </div>
              </div>

              <form action={seDeconnecter} className="shrink-0">
                <Bouton type="submit" variante="secondaire" taille="compacte">
                  Se déconnecter
                </Bouton>
              </form>
            </div>
          </div>
        )}

        {onglet === "donnees" && (
          <div className="space-y-6 divide-y divide-bordure/60">
            {/* Ligne 1 : Sauvegarde & Export */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-texte">
                  Sauvegarde & Export souverain du journal
                </h4>
                <p className="text-xs text-texte-attenue max-w-lg leading-relaxed">
                  Téléchargez l&apos;intégralité de vos données en JSON — observations, séances, exercices,
                  compétences, documents et profil. C&apos;est votre copie souveraine hors ligne.
                </p>
                {messageExport && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-succes font-medium">
                    <IconeValide className="size-3.5 shrink-0" />
                    <span>{messageExport}</span>
                  </p>
                )}
              </div>
              <Bouton
                variante="secondaire"
                taille="compacte"
                onClick={telechargerArchive}
                enChargement={exportEnCours}
                className="shrink-0 shadow-xs"
              >
                Exporter mon journal JSON
              </Bouton>
            </div>

            {/* Ligne 2 : Zone de danger */}
            <div className="pt-6">
              <div className="rounded-xl border border-danger/30 bg-danger-faible/20 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-danger">
                    Zone de danger — réinitialisation des données
                  </h4>
                  <p className="text-xs text-texte-attenue">
                    Réinitialisez toutes vos données d&apos;apprentissage ou supprimez-les définitivement.
                  </p>
                </div>
                <Bouton
                  variante="danger"
                  taille="compacte"
                  onClick={() => setModaleDangerOuverte(true)}
                  className="shrink-0"
                >
                  Réinitialiser mes données…
                </Bouton>
              </div>
            </div>
          </div>
        )}
      </div>

      {modaleDangerOuverte && (
        <ModaleDangerCompte compteId={compteId} onFermer={() => setModaleDangerOuverte(false)} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Choix d'apparence                                                  */
/* ------------------------------------------------------------------ */

type CleApparence = "clair" | "dark" | "systeme";

const APPARENCES: { cle: CleApparence; theme: ChoixTheme; libelle: string }[] = [
  { cle: "clair", theme: "clair", libelle: "Clair" },
  { cle: "dark", theme: "dark", libelle: "Sombre" },
  { cle: "systeme", theme: null, libelle: "Système" },
];

function ChoixApparence() {
  const [choix, setChoix] = useState<ChoixTheme>(lireChoixTheme);

  function choisir(c: ChoixTheme) {
    appliquerTheme(c);
    setChoix(c);
  }

  const actif = APPARENCES.find((a) => a.theme === choix)?.cle ?? "systeme";

  return (
    <SelecteurSegmente
      options={APPARENCES.map((a) => ({ cle: a.cle, libelle: a.libelle }))}
      actif={actif}
      rendreItem={(o, classesItem, estActifItem) => (
        <button
          key={o.cle}
          type="button"
          onClick={() => choisir(APPARENCES.find((a) => a.cle === o.cle)!.theme)}
          aria-pressed={estActifItem}
          className={classesItem}
        >
          {o.libelle}
        </button>
      )}
    />
  );
}
