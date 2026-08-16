"use client";

import { useState } from "react";
import { Bouton, cx, SelecteurSegmente } from "@/components/ui/primitives";
import { Champ, ChampSelect, classesChamp } from "@/components/ui/champ";
import { seDeconnecter } from "@/lib/supabase/actions";
import { exporterJournal } from "@/lib/store/export";
import { IconeValide } from "@/components/ui/icones";
import { FormulaireProfil } from "@/components/profil/formulaire-profil";
import { ModaleDangerCompte } from "@/components/layout/modale-danger-compte";
import { appliquerTheme, lireChoixTheme, type ChoixTheme } from "@/components/layout/theme";
import type { User } from "@/lib/domain/types";
import {
  FOURNISSEURS,
  ecrireConfigTuteur,
  effacerConfigTuteur,
  lireConfigTuteur,
  masquerCle,
  type ConfigTuteurClient,
  type FournisseurTuteur,
} from "@/lib/tutor/cle-client";
import { validerUrlFournisseur } from "@/lib/tutor/url-fournisseur";

/**
 * Les réglages du compte, sur une page — et non plus dans une modale à onglets.
 *
 * Ce qui vivait ici : une modale « Compte et réglages » à trois onglets, qui en
 * ouvrait une deuxième (« Danger compte »), qui en ouvrait une troisième
 * (« Supprimer ou réinitialiser les données »). Trois modales empilées pour des
 * réglages qu'on ne consulte pas au milieu d'un travail — et qui, du coup, ne
 * pouvaient être ni mises en signet, ni ouvertes dans un onglet, ni retrouvées
 * par l'historique du navigateur.
 *
 * Les trois onglets deviennent trois sections empilées : sur une page, il n'y a
 * plus de raison de cacher deux tiers du contenu pour tenir dans une fenêtre.
 * La zone de danger garde sa modale de confirmation, elle : c'est une garde
 * avant une action irréversible, pas un rangement.
 *
 * `profil` est chargé par le serveur et passé en prop — l'ancienne modale allait
 * le chercher elle-même dans un effet, avec sa phase « Chargement du profil… »
 * à chaque ouverture.
 */
export function PanneauCompte({
  profil,
  compteId,
  courriel,
}: {
  profil: User;
  compteId: string;
  courriel: string | null;
}) {
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
      <Section titre="Profil d'apprentissage">
        <FormulaireProfil
          formation={nonRenseigne(profil.formation)}
          objectifMoyenTerme={nonRenseigne(profil.objectifMoyenTerme)}
          objectifLongTerme={nonRenseigne(profil.objectifLongTerme)}
          preferencesPedagogiques={profil.preferencesPedagogiques ?? []}
          plan={profil.plan}
        />
      </Section>

      <Section titre="Tuteur IA">
        <ReglagesTuteur compteId={compteId} />
      </Section>

      <Section titre="Apparence">
        <ChoixApparence />
      </Section>

      <Section titre="Compte et synchronisation">
        <div className="flex items-center gap-3">
          {profil.avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={profil.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="size-10 shrink-0 rounded-full border border-bordure object-cover"
            />
          ) : (
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primaire text-sm font-semibold text-primaire-contraste">
              {profil.prenom?.charAt(0).toUpperCase() || "C"}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-texte">{profil.prenom || "Compte"}</p>
            <div className="flex items-center gap-1.5 text-xs text-texte-attenue">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-succes" />
              <span className="truncate">{courriel ?? "compte sans courriel"}</span>
            </div>
          </div>
        </div>
        <form action={seDeconnecter} className="mt-4">
          <Bouton type="submit" variante="secondaire" taille="compacte">
            Se déconnecter
          </Bouton>
        </form>
      </Section>

      <Section titre="Sauvegarde et journal">
        <p className="text-xs leading-relaxed text-texte-attenue">
          Télécharge l&apos;intégralité de ton journal en JSON — preuves, séances, exercices,
          tentatives, compétences, documents de l&apos;atelier et profil. C&apos;est ta copie
          souveraine hors ligne.
        </p>
        <Bouton
          variante="secondaire"
          taille="compacte"
          onClick={telechargerArchive}
          enChargement={exportEnCours}
          className="mt-2.5"
        >
          Exporter mon journal JSON
        </Bouton>
        {messageExport && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-texte">
            <IconeValide className="mt-0.5 size-3.5 shrink-0 text-succes" />
            <span>{messageExport}</span>
          </p>
        )}
      </Section>

      <section className="rounded-xl border border-danger/30 bg-danger-faible/30 px-5 py-4 sm:px-6">
        <h2 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-danger">
          Zone de danger — réinitialisation et données
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-texte-attenue">
          Réinitialise l&apos;ensemble de tes données d&apos;apprentissage ou supprime
          définitivement toutes les informations de ton compte.
        </p>
        <Bouton
          variante="danger"
          taille="compacte"
          onClick={() => setModaleDangerOuverte(true)}
          className="mt-2.5"
        >
          Réinitialiser ou supprimer mes données…
        </Bouton>
      </section>

      {modaleDangerOuverte && (
        <ModaleDangerCompte compteId={compteId} onFermer={() => setModaleDangerOuverte(false)} />
      )}
    </div>
  );
}

function Section({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-bordure bg-surface px-5 py-4 sm:px-6">
      <h2 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-texte-discret">
        {titre}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Réglages du tuteur IA — clé API saisie côté client                  */
/* ------------------------------------------------------------------ */

/**
 * Section de saisie de la clé API du tuteur.
 *
 * La clé est stockée dans le navigateur (`localStorage`, isolée par compte) et
 * envoyée à la route `/api/tutor` à chaque message. Elle ne quitte jamais le
 * navigateur pour un tiers.
 *
 * Un fournisseur pré-remplit l'URL de base et le modèle ; seul le champ clé
 * est obligatoire. Le bouton « Effacer » supprime la config et revient au
 * repli « copier le contexte ».
 */
function ReglagesTuteur({ compteId }: { compteId: string }) {
  const [config, setConfig] = useState<ConfigTuteurClient | null>(() => lireConfigTuteur(compteId));
  const [fournisseur, setFournisseur] = useState<FournisseurTuteur>(
    () => config?.fournisseur ?? "mistral",
  );
  const [cle, setCle] = useState(() => config?.cle ?? "");
  const [urlBase, setUrlBase] = useState(() => config?.urlBase ?? "");
  const [modele, setModele] = useState(() => config?.modele ?? "");
  const [afficherCle, setAfficherCle] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const preset = FOURNISSEURS.find((f) => f.cle === fournisseur);
  const estAnthropic = preset?.anthropic === true;

  // Quand le fournisseur change, on pré-remplit l'URL et le modèle avec les
  // valeurs par défaut du preset — sauf si l'utilisateur a déjà saisi une
  // valeur personnalisée pour ce fournisseur.
  function choisirFournisseur(f: FournisseurTuteur) {
    setFournisseur(f);
    const p = FOURNISSEURS.find((x) => x.cle === f);
    if (p?.urlBase && !urlBase) setUrlBase(p.urlBase);
    if (p?.modeleParDefaut && !modele) setModele(p.modeleParDefaut);
  }

  function enregistrer() {
    const cleTrim = cle.trim();
    if (cleTrim === "") {
      setMessage("Saisis ta clé API avant d'enregistrer.");
      return;
    }
    if (!estAnthropic) {
      const url = urlBase.trim() || preset?.urlBase || "";
      const mod = modele.trim() || preset?.modeleParDefaut || "";
      if (!url || !mod) {
        setMessage("L'URL de base et le modèle sont requis pour ce fournisseur.");
        return;
      }
      /*
       * Même règle qu'au serveur, dite au bon moment.
       *
       * Le serveur refuse déjà cette URL (`configVersEnv`) et c'est lui qui
       * fait autorité — l'interface est contournable. Mais laisser enregistrer
       * une configuration dont on sait qu'elle sera rejetée reporterait le
       * refus au premier message envoyé au tuteur, loin du champ fautif.
       */
      const validation = validerUrlFournisseur(url);
      if (!validation.ok) {
        setMessage(validation.motif);
        return;
      }
      ecrireConfigTuteur(compteId, { fournisseur, cle: cleTrim, urlBase: url, modele: mod });
    } else {
      ecrireConfigTuteur(compteId, {
        fournisseur,
        cle: cleTrim,
        ...(modele.trim() ? { modele: modele.trim() } : {}),
      });
    }
    setConfig(lireConfigTuteur(compteId));
    setMessage("Clé enregistrée. Le chat intégré est désormais actif.");
  }

  function effacer() {
    effacerConfigTuteur(compteId);
    setConfig(null);
    setCle("");
    setUrlBase("");
    setModele("");
    setMessage("Clé effacée. Le chat bascule en mode « copier le contexte ».");
  }

  return (
    <div className="space-y-2.5">
      {config && (
        <div className="flex items-center gap-1.5 text-xs">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-succes" />
          <span className="text-texte-attenue">Clé configurée — {masquerCle(config.cle)}</span>
        </div>
      )}

      <ChampSelect
        label="Fournisseur"
        taille="compacte"
        value={fournisseur}
        onChange={(e) => choisirFournisseur(e.target.value as FournisseurTuteur)}
        options={FOURNISSEURS.map((f) => ({ valeur: f.cle, libelle: f.libelle }))}
      />

      {/*
        Champ composé (saisie + bouton afficher/masquer sur la même ligne) :
        `Champ` ne représente pas cette forme, donc `classesChamp` porte le
        même style à la main plutôt que de le redupliquer en chaîne.
      */}
      <div>
        <label className="text-[0.6875rem] font-medium text-texte-attenue">Clé API</label>
        <div className="mt-0.5 flex gap-1.5">
          <input
            type={afficherCle ? "text" : "password"}
            value={cle}
            onChange={(e) => setCle(e.target.value)}
            placeholder={preset?.aide ?? "Colle ta clé ici"}
            className={cx(classesChamp("compacte", false), "min-w-0 flex-1")}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setAfficherCle((v) => !v)}
            className="shrink-0 rounded-md border border-bordure bg-surface px-2 py-1 text-[0.6875rem] text-texte-attenue transition-colors hover:bg-surface-2"
            title={afficherCle ? "Masquer la clé" : "Afficher la clé"}
          >
            {afficherCle ? "Masquer" : "Afficher"}
          </button>
        </div>
      </div>

      {/* URL de base — masquée pour Anthropic */}
      {!estAnthropic && (
        <Champ
          label="URL de base"
          taille="compacte"
          type="text"
          value={urlBase}
          onChange={(e) => setUrlBase(e.target.value)}
          placeholder={preset?.urlBase ?? "https://api.exemple.com/v1"}
          spellCheck={false}
        />
      )}

      <Champ
        label={preset?.modeleParDefaut ? `Modèle (défaut : ${preset.modeleParDefaut})` : "Modèle"}
        taille="compacte"
        type="text"
        value={modele}
        onChange={(e) => setModele(e.target.value)}
        placeholder={preset?.modeleParDefaut ?? "nom-du-modele"}
        spellCheck={false}
      />

      {preset?.aide && (
        <p className="text-[0.6875rem] leading-relaxed text-texte-discret">{preset.aide}</p>
      )}

      <p className="text-[0.6875rem] leading-relaxed text-texte-discret">
        La clé est stockée dans ton navigateur, isolée par compte, et n&apos;est jamais envoyée
        ailleurs qu&apos;à la route du tuteur (même origine).
      </p>

      <div className="flex gap-1.5">
        <Bouton variante="principal" taille="compacte" onClick={enregistrer}>
          Enregistrer
        </Bouton>
        {config && (
          <Bouton variante="danger" taille="compacte" onClick={effacer}>
            Effacer
          </Bouton>
        )}
      </div>

      {message && <p className="text-[0.6875rem] text-texte-attenue">{message}</p>}
    </div>
  );
}

/*
 * Clés en chaîne, pas `ChoixTheme` directement : `SelecteurSegmente` est
 * générique sur une clé `string`, et `ChoixTheme` porte `null` (« suivre le
 * système ») — la conversion se fait aux deux frontières de `ChoixApparence`
 * plutôt que d'élargir le composant partagé pour ce seul cas.
 */
type CleApparence = "clair" | "dark" | "systeme";

const APPARENCES: { cle: CleApparence; theme: ChoixTheme; libelle: string }[] = [
  { cle: "clair", theme: "clair", libelle: "Clair" },
  { cle: "dark", theme: "dark", libelle: "Sombre" },
  { cle: "systeme", theme: null, libelle: "Système" },
];

/**
 * Choix du thème — clair, sombre, ou suivre le système.
 *
 * Lecture du stockage à l'initialisation, pas dans un effet : `lireChoixTheme`
 * retombe sur `null` si le stockage est indisponible, et le composant n'est
 * rendu qu'après hydratation de la page de compte.
 */
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
