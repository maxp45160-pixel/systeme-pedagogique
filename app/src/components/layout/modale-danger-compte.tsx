"use client";

import { useId, useState } from "react";
import { Modale } from "@/components/ui/modale";
import { Bouton, cx } from "@/components/ui/primitives";
import { classesChamp } from "@/components/ui/champ";
import {
  reinitialiserDonneesCompteAction,
  type ModeReinitialisationCompte,
} from "@/lib/store/compte-actions";
import { exporterJournal } from "@/lib/store/export";
import { effacerConfigTuteur } from "@/lib/tutor/cle-client";

const PHRASE_VALIDATION = "SUPPRIMER MES DONNEES";
const PHRASE_AFFICHAGE = "SUPPRIMER MES DONNÉES";

function normaliser(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

export function ModaleDangerCompte({
  compteId,
  onFermer,
}: {
  compteId: string;
  onFermer: () => void;
}) {
  const [mode, setMode] = useState<ModeReinitialisationCompte>("reset");
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [messageExport, setMessageExport] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const idSaisie = useId();

  const phraseValide = normaliser(saisie) === PHRASE_VALIDATION;

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

      setMessageExport(`Archive téléchargée (${total} enregistrements).`);
    } catch (err) {
      setMessageExport(
        err instanceof Error ? err.message : "Échec du téléchargement de l'archive.",
      );
    } finally {
      setExportEnCours(false);
    }
  }

  function nettoyerStockageClient(mode: ModeReinitialisationCompte) {
    try {
      // La clé API du tuteur est un réglage navigateur indépendant des données
      // d'apprentissage : elle survit à un « reset » (l'utilisateur reste
      // connecté et va re-configurer son référentiel avec l'IA). Elle n'est
      // effacée que lors d'une suppression totale du compte, où l'isolation
      // par compte la rend orpheline.
      if (mode === "supprimer_et_deconnecter") {
        effacerConfigTuteur(compteId);
      }
      window.localStorage.removeItem(`graphe:reglages:${compteId}`);
      window.localStorage.removeItem(`atelier:dossiers:${compteId}`);
      window.localStorage.removeItem("dossiers");
      window.sessionStorage.clear();
    } catch {
      // Ignorer si stockage inaccessible
    }
  }

  async function executerAction() {
    if (!phraseValide || enCours) return;
    setEnCours(true);
    setErreur(null);

    try {
      nettoyerStockageClient(mode);
      const resultat = await reinitialiserDonneesCompteAction(mode);
      if (resultat?.succes) {
        onFermer();
        // Après un reset, le référentiel est vide : on renvoie directement sur
        // l'écran d'amorçage (`/demarrer`), qui est l'état d'un compte neuf.
        // `window.location.reload()` laissait l'utilisateur sur `/compte` sans
        // lui dire quoi faire ensuite. Le mode « supprimer_et_deconnecter » ne
        // passe pas par ici : le serveur redirige vers `/login` et le client ne
        // reçoit jamais `resultat`.
        window.location.href = "/demarrer";
      }
    } catch (err) {
      setErreur(
        err instanceof Error ? err.message : "Une erreur est survenue lors de la réinitialisation.",
      );
      setEnCours(false);
    }
  }

  return (
    <Modale
      titre="Supprimer ou réinitialiser les données"
      sousTitre="Cette action est irréversible. L'ensemble des données d'apprentissage et de travail du compte seront définitivement effacées."
      largeur="2xl"
      onFermer={onFermer}
      pied={
        <div className="flex w-full items-center justify-between gap-2">
          <Bouton
            type="button"
            variante="secondaire"
            taille="compacte"
            onClick={onFermer}
            disabled={enCours}
          >
            Annuler
          </Bouton>

          <Bouton
            type="button"
            variante="danger"
            taille="compacte"
            disabled={!phraseValide || enCours}
            enChargement={enCours}
            onClick={executerAction}
          >
            {mode === "reset"
              ? "Confirmer la réinitialisation"
              : "Confirmer la suppression et déconnexion"}
          </Bouton>
        </div>
      }
    >
      <div className="space-y-4 py-1 text-sm">
        {/* Avertissement textuel sobre */}
        <div className="rounded-lg border border-danger/30 bg-danger-faible/30 p-3.5 text-danger">
          <div className="font-semibold text-xs uppercase tracking-wide">
            Attention — Suppression définitive
          </div>
          <p className="mt-1 text-xs leading-relaxed text-texte">
            Toutes les données rattachées à ce compte dans la base de données seront
            irrémédiablement détruites. Aucune restauration n&apos;est possible sans copie
            de sauvegarde préalable.
          </p>
        </div>

        {/* Données impactées */}
        <div className="rounded-lg border border-bordure bg-surface-2/60 p-3.5">
          <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret mb-2">
            Données qui seront effacées
          </div>
          <ul className="space-y-1.5 text-xs text-texte-attenue list-disc list-inside">
            <li>Référentiel de compétences (domaines, codes et compétences créées)</li>
            <li>Preuves de compétence et historique de maîtrise</li>
            <li>Séances d&apos;apprentissage et tentatives d&apos;exercices</li>
            <li>Exercices personnalisés créés dans le compte</li>
            <li>Documents, notes et pièces jointes de l&apos;Atelier</li>
            <li>Objectifs déclarés, plan de travail et clés d&apos;accès locales</li>
          </ul>
        </div>

        {/* Option de sauvegarde */}
        <div className="rounded-lg border border-bordure bg-surface-2/60 p-3.5">
          <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret mb-1">
            Sauvegarde souveraine préalable
          </div>
          <p className="text-xs text-texte-attenue mb-2.5 leading-relaxed">
            Il est fortement conseillé de télécharger l&apos;archive JSON complète de ton journal
            avant d&apos;effectuer la suppression.
          </p>
          <div className="flex items-center gap-3">
            <Bouton
              type="button"
              variante="secondaire"
              taille="compacte"
              onClick={telechargerArchive}
              enChargement={exportEnCours}
            >
              Exporter mon journal JSON
            </Bouton>
            {messageExport && (
              <span className="text-xs text-succes">{messageExport}</span>
            )}
          </div>
        </div>

        {/* Choix du mode */}
        <div className="rounded-lg border border-bordure bg-surface-2/60 p-3.5 space-y-2">
          <div className="text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret">
            Option de traitement
          </div>
          <div className="space-y-2 text-xs">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="mode-reinit"
                value="reset"
                checked={mode === "reset"}
                onChange={() => setMode("reset")}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-texte">
                  Remettre à zéro les données (repartir sur un compte vierge)
                </div>
                <div className="text-texte-discret mt-0.5">
                  Toutes les données sont purgées et le profil est réinitialisé par défaut. Tu restes
                  connecté.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="radio"
                name="mode-reinit"
                value="supprimer_et_deconnecter"
                checked={mode === "supprimer_et_deconnecter"}
                onChange={() => setMode("supprimer_et_deconnecter")}
                className="mt-0.5"
              />
              <div>
                <div className="font-medium text-texte">
                  Supprimer toutes les données et me déconnecter
                </div>
                <div className="text-texte-discret mt-0.5">
                  Toutes les données sont purgées, la session est fermée et tu es redirigé vers
                  l&apos;écran de connexion.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Saisie de la phrase de validation */}
        <div className="rounded-lg border border-bordure bg-surface-2/60 p-3.5 space-y-2">
          <label
            htmlFor={idSaisie}
            className="block text-[0.6875rem] font-semibold uppercase tracking-wide text-texte-discret"
          >
            Confirmation obligatoire par phrase
          </label>
          <p className="text-xs text-texte-attenue">
            Pour débloquer la validation, saisis exactement la phrase suivante :
          </p>
          <div className="font-mono text-xs font-bold tracking-wide text-danger bg-surface p-2 rounded border border-bordure select-all">
            {PHRASE_AFFICHAGE}
          </div>
          <input
            id={idSaisie}
            type="text"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            placeholder={PHRASE_AFFICHAGE}
            className={cx(classesChamp("compacte", false), "w-full font-mono")}
            autoComplete="off"
            spellCheck={false}
          />
          {saisie.trim() !== "" && !phraseValide && (
            <p className="text-[0.6875rem] text-danger">
              La phrase saisie ne correspond pas encore à la confirmation requise.
            </p>
          )}
        </div>

        {erreur && (
          <div className="rounded-lg border border-danger/40 bg-danger-faible/40 p-3 text-xs text-danger">
            {erreur}
          </div>
        )}
      </div>
    </Modale>
  );
}
