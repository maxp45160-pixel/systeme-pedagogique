"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Modale } from "@/components/ui/modale";
import { IconeAmpoule, IconeCours, IconeDocuments, IconeFormule, IconePlus, IconeProjet } from "@/components/ui/icones";
import { creerNoteAction } from "@/lib/store/document-actions";
import { ModaleCompetence } from "@/components/referentiel/modale-competence";
import { ModaleReferentiel } from "@/components/referentiel/modale-referentiel";
import { ParcoursNouveauProjet } from "@/components/projets/modale-nouveau-projet";
import type { CompetenceModale } from "@/lib/domain/proprietes-generation";

export type CreationAtelier =
  | "domaine"
  | "competence"
  | "ressource"
  | "cours"
  | "formule"
  | "projet"
  | "feynman";

const CREATIONS_ATELIER: readonly CreationAtelier[] = [
  "domaine",
  "competence",
  "ressource",
  "cours",
  "formule",
  "projet",
  "feynman",
];

const LIBELLES_CREATION: Record<CreationAtelier, string> = {
  domaine: "Ajouter un domaine",
  competence: "Ajouter une compétence",
  ressource: "Ajouter une ressource",
  cours: "Créer une fiche de cours",
  formule: "Enregistrer une formule",
  projet: "Lancer un projet",
  feynman: "Faire une explication Feynman",
};

const TYPES_DOCUMENT: Record<"ressource" | "cours" | "formule", {
  titre: string;
  type: string;
  titreInitial: string;
  placeholder: string;
}> = {
  ressource: {
    titre: "Ajouter une ressource",
    type: "reference",
    titreInitial: "Nouvelle ressource",
    placeholder: "Ex. article, PDF ou ressource à garder",
  },
  cours: {
    titre: "Créer une fiche de cours",
    type: "cours",
    titreInitial: "Fiche de cours",
    placeholder: "Ex. synthèse du chapitre sur les matrices",
  },
  formule: {
    titre: "Enregistrer une formule",
    type: "formule",
    titreInitial: "Nouvelle formule",
    placeholder: "Ex. formule de Bayes et conditions d’application",
  },
};

const ICONES_CREATION: Record<CreationAtelier, typeof IconePlus> = {
  domaine: IconeDocuments,
  competence: IconeAmpoule,
  ressource: IconeDocuments,
  cours: IconeCours,
  formule: IconeFormule,
  projet: IconeProjet,
  feynman: IconeAmpoule,
};

function estCreationAtelier(valeur: string | undefined): valeur is CreationAtelier {
  return Boolean(valeur && CREATIONS_ATELIER.includes(valeur as CreationAtelier));
}

function actionsPourVue(vue: "domaines" | "ressources" | "graphe"): CreationAtelier[] {
  if (vue === "ressources") return ["ressource", "cours", "formule", "projet"];
  if (vue === "graphe") return ["competence", "feynman", "domaine"];
  return ["domaine", "competence", "feynman"];
}

export function ActionsCreationAtelier({
  compteId,
  domainesExistants,
  competences,
  vue,
  creationInitiale,
  domaineInitial,
}: {
  compteId: string;
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  competences: CompetenceModale[];
  vue: "domaines" | "ressources" | "graphe";
  creationInitiale?: string;
  domaineInitial?: string;
}) {
  const racine = useRef<HTMLDivElement>(null);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [creation, setCreation] = useState<CreationAtelier | null>(
    estCreationAtelier(creationInitiale) ? creationInitiale : null,
  );

  useEffect(() => {
    if (!menuOuvert) return;

    function fermerSiExterieur(event: PointerEvent) {
      if (event.target instanceof Node && !racine.current?.contains(event.target)) {
        setMenuOuvert(false);
      }
    }

    function fermerAvecEchap(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOuvert(false);
    }

    document.addEventListener("pointerdown", fermerSiExterieur);
    document.addEventListener("keydown", fermerAvecEchap);
    return () => {
      document.removeEventListener("pointerdown", fermerSiExterieur);
      document.removeEventListener("keydown", fermerAvecEchap);
    };
  }, [menuOuvert]);

  const actions = useMemo(() => actionsPourVue(vue), [vue]);
  const ouvrirCreation = (action: CreationAtelier) => {
    setMenuOuvert(false);
    setCreation(action);
  };
  const fermerCreation = () => {
    setCreation(null);
    if (creationInitiale && typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("creation");
      window.history.replaceState(null, "", url);
    }
  };

  return (
    <>
      <div ref={racine} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOuvert((ouvert) => !ouvert)}
          aria-expanded={menuOuvert}
          aria-haspopup="menu"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primaire px-3 py-1.5 text-xs font-semibold text-texte-inverse shadow-sm transition-colors hover:bg-primaire-survol focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primaire/40"
        >
          <IconePlus className="size-3.5" />
          <span>Créer</span>
        </button>

        {menuOuvert && (
          <div
            role="menu"
            aria-label="Actions de création"
            className="absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-bordure bg-surface p-1.5 shadow-[var(--ombre-surcouche)]"
          >
            {actions.map((action) => {
              const Icone = ICONES_CREATION[action];
              return (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  onClick={() => ouvrirCreation(action)}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs text-texte-attenue transition-colors hover:bg-primaire-faible hover:text-primaire"
                >
                  <Icone className="size-4 shrink-0" />
                  <span>{LIBELLES_CREATION[action]}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {creation === "domaine" && (
        <ModaleReferentiel compteId={compteId} onFermer={fermerCreation} />
      )}
      {creation === "competence" && (
        <ModaleCompetence
          compteId={compteId}
          domainesExistants={domainesExistants}
          modeCible="competence"
          domaineInitial={domaineInitial}
          onFermer={fermerCreation}
        />
      )}
      {(creation === "ressource" || creation === "cours" || creation === "formule") && (
        <ModaleCreationDocument
          domainesExistants={domainesExistants}
          domaineInitial={domaineInitial}
          type={creation}
          onFermer={fermerCreation}
        />
      )}
      {creation === "projet" && (
        <ParcoursNouveauProjet
          accountId={compteId}
          intentionInitiale="Je veux construire un projet pratique"
          onFermer={fermerCreation}
        />
      )}
      {creation === "feynman" && (
        <ModaleFeynman competences={competences} onFermer={fermerCreation} />
      )}
    </>
  );
}

function ModaleCreationDocument({
  domainesExistants,
  domaineInitial,
  type,
  onFermer,
}: {
  domainesExistants: { id: string; nom: string; prefixe: string }[];
  domaineInitial?: string;
  type: "ressource" | "cours" | "formule";
  onFermer: () => void;
}) {
  const router = useRouter();
  const [titre, setTitre] = useState(TYPES_DOCUMENT[type].titreInitial);
  const [contexte, setContexte] = useState("");
  const [domaine, setDomaine] = useState(domaineInitial ?? "transversal");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useState(false);
  const definition = TYPES_DOCUMENT[type];

  async function creer() {
    const titreNettoye = titre.trim();
    const contexteNettoye = contexte.trim();
    if (!titreNettoye || !contexteNettoye) {
      setErreur("Renseigne un titre et le contexte de cette fiche.");
      return;
    }

    demarrer(true);
    setErreur(null);
    try {
      const fiche = await creerNoteAction("support", definition.type, titreNettoye, {
        contexte: contexteNettoye,
        domaine,
      });
      onFermer();
      router.push(`/atelier?note=${encodeURIComponent(fiche.id)}`);
      router.refresh();
    } catch (cause) {
      setErreur(cause instanceof Error ? cause.message : "Création impossible.");
      demarrer(false);
    }
  }

  return (
    <Modale
      titre={definition.titre}
      sousTitre="La fiche s’ouvrira dans l’Atelier. Tu pourras ensuite y joindre un PDF."
      largeur="xl"
      onFermer={onFermer}
      pied={
        <>
          <button
            type="button"
            onClick={onFermer}
            className="cursor-pointer rounded-lg border border-bordure-controle px-3 py-1.5 text-xs font-medium text-texte-attenue transition-colors hover:bg-surface-2"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => void creer()}
            disabled={enCours}
            className="cursor-pointer rounded-lg bg-primaire px-3 py-1.5 text-xs font-semibold text-texte-inverse transition-colors hover:bg-primaire-survol disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enCours ? "Création…" : "Créer la fiche"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs font-medium text-texte">Titre</span>
          <input
            value={titre}
            onChange={(event) => setTitre(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-texte-discret focus:border-primaire focus:ring-1 focus:ring-primaire/20"
            placeholder={definition.placeholder}
            autoFocus
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-texte">Contexte</span>
          <textarea
            value={contexte}
            onChange={(event) => setContexte(event.target.value)}
            rows={4}
            className="mt-1.5 w-full resize-none rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none transition-colors placeholder:text-texte-discret focus:border-primaire focus:ring-1 focus:ring-primaire/20"
            placeholder="Pourquoi veux-tu garder cette fiche ?"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-texte">Domaine</span>
          <select
            value={domaine}
            onChange={(event) => setDomaine(event.target.value)}
            className="mt-1.5 w-full cursor-pointer rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none focus:border-primaire focus:ring-1 focus:ring-primaire/20"
          >
            <option value="transversal">Transversal</option>
            {domainesExistants.map((domaineExistant) => (
              <option key={domaineExistant.id} value={domaineExistant.id}>
                {domaineExistant.nom}
              </option>
            ))}
          </select>
        </label>

        {erreur && <p className="rounded-lg bg-danger-faible px-3 py-2 text-xs text-danger">{erreur}</p>}
      </div>
    </Modale>
  );
}

function ModaleFeynman({
  competences,
  onFermer,
}: {
  competences: CompetenceModale[];
  onFermer: () => void;
}) {
  const router = useRouter();
  const [recherche, setRecherche] = useState("");
  const terme = recherche.trim().toLocaleLowerCase("fr");
  const competencesFiltrees = useMemo(
    () =>
      competences.filter((competence) =>
        `${competence.intitule} ${competence.code} ${competence.domaine}`
          .toLocaleLowerCase("fr")
          .includes(terme),
      ),
    [competences, terme],
  );

  return (
    <Modale
      titre="Faire une explication Feynman"
      sousTitre="Choisis la compétence que tu veux reformuler avec tes propres mots."
      largeur="xl"
      onFermer={onFermer}
    >
      <div className="space-y-3">
        <input
          value={recherche}
          onChange={(event) => setRecherche(event.target.value)}
          placeholder="Rechercher une compétence…"
          aria-label="Rechercher une compétence pour Feynman"
          className="w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm outline-none focus:border-primaire focus:ring-1 focus:ring-primaire/20"
          autoFocus
        />
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {competencesFiltrees.map((competence) => (
            <button
              key={competence.code}
              type="button"
              onClick={() => {
                onFermer();
                router.push(`/expliquer?code=${encodeURIComponent(competence.code)}`);
              }}
              className="flex w-full cursor-pointer items-start gap-3 rounded-lg border border-bordure bg-surface-2/50 px-3 py-2.5 text-left transition-colors hover:border-primaire/40 hover:bg-primaire-faible"
            >
              <IconeAmpoule className="mt-0.5 size-4 shrink-0 text-primaire" />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-texte">{competence.intitule}</span>
                <span className="mt-0.5 block text-[0.6875rem] text-texte-discret">
                  {competence.code} · {competence.domaine}
                </span>
              </span>
            </button>
          ))}
          {competencesFiltrees.length === 0 && (
            <p className="py-8 text-center text-xs text-texte-discret">Aucune compétence ne correspond.</p>
          )}
        </div>
      </div>
    </Modale>
  );
}
