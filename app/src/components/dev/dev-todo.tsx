"use client";

/**
 * Widget TODO de développement — bouton flottant + modale.
 *
 * Les TODOs sont partagées entre tous les comptes connectés (pas de `user_id`).
 * Le glisser-déposer utilise l'API HTML5 native pour éviter toute dépendance.
 *
 * L'ordre affiché est la seule référence : les tâches faites descendent en bas
 * de liste, et un déplacement renumérote la liste *telle qu'elle est vue*. Un
 * réordonnancement calculé sur le tableau brut ferait sauter les lignes ailleurs
 * que là où elles ont été lâchées.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/components/ui/primitives";
import { IconeTodo, IconeGrip } from "@/components/ui/icones";
import { mesurerInteraction } from "@/lib/profiling/client";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface DevTodo {
  id: string;
  texte: string;
  priorite: "haute" | "moyenne" | "basse";
  fait: boolean;
  ordre: number;
  creeA: string;
  auteur?: string;
  images?: string[];
}

type Priorite = DevTodo["priorite"];

const PRIORITES: { valeur: Priorite; label: string; pastille: string }[] = [
  { valeur: "haute",   label: "Haute",   pastille: "bg-danger"  },
  { valeur: "moyenne", label: "Moyenne", pastille: "bg-alerte"  },
  { valeur: "basse",   label: "Basse",   pastille: "bg-succes"  },
];

/* ------------------------------------------------------------------ */
/* Helpers API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Un appel qui échoue doit se voir. La route répond en JSON `{ erreur, message }` :
 * on remonte le message plutôt que d'avaler l'échec et de laisser l'interface
 * afficher un état qui n'existe pas côté serveur.
 */
async function appel<T>(
  url: string,
  init?: RequestInit,
): Promise<{ donnees: T; erreur: null } | { donnees: null; erreur: string }> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    return { donnees: null, erreur: "Serveur injoignable." };
  }

  if (!res.ok) {
    if (res.status === 401) {
      return { donnees: null, erreur: "Session expirée — reconnecte-toi pour modifier les TODOs." };
    }
    const detail = await res.json().catch(() => null);
    return {
      donnees: null,
      erreur: (detail?.message as string) ?? (detail?.erreur as string) ?? `Erreur ${res.status}.`,
    };
  }

  return { donnees: (await res.json()) as T, erreur: null };
}

const JSON_INIT = { headers: { "Content-Type": "application/json" } };

const api = {
  lister: () => appel<DevTodo[]>("/api/dev-todos"),

  creer: (texte: string, priorite: Priorite) =>
    appel<DevTodo>("/api/dev-todos", {
      method: "POST",
      ...JSON_INIT,
      body: JSON.stringify({ texte, priorite }),
    }),

  modifier: (id: string, champs: Partial<DevTodo>) =>
    appel<DevTodo>("/api/dev-todos", {
      method: "PUT",
      ...JSON_INIT,
      body: JSON.stringify({ id, ...champs }),
    }),

  reordonner: (ordres: { id: string; ordre: number }[]) =>
    appel<{ ok: true }>("/api/dev-todos", {
      method: "PATCH",
      ...JSON_INIT,
      body: JSON.stringify({ ordres }),
    }),

  supprimer: (id: string) =>
    appel<{ ok: true }>(`/api/dev-todos?id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  televerser: (fichier: File) => {
    const form = new FormData();
    form.append("fichier", fichier);
    return appel<{ url: string }>("/api/dev-todos/upload", { method: "POST", body: form });
  },
};

/* ------------------------------------------------------------------ */
/* Sous-composant : menu ⋯                                            */
/* ------------------------------------------------------------------ */

function MenuTroisPoints({
  ouvert,
  onToggle,
  onRenommer,
  onAttacherImage,
  onSupprimer,
}: {
  ouvert: boolean;
  onToggle: () => void;
  onRenommer: () => void;
  onAttacherImage: () => void;
  onSupprimer: () => void;
}) {
  const [versLeHaut, setVersLeHaut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Le menu s'ouvre normalement sous le bouton, mais pour les dernières lignes
  // de la liste il n'y a pas la place : on l'ouvre alors vers le haut pour
  // qu'il reste visible sans avoir à faire défiler la modale.
  useLayoutEffect(() => {
    if (!ouvert) return;
    const rect = ref.current?.getBoundingClientRect();
    const conteneur = ref.current?.closest(".overflow-y-auto")?.getBoundingClientRect();
    const limiteBasse = conteneur ? conteneur.bottom : window.innerHeight;
    const hauteurMenuEstimee = 130;
    setVersLeHaut(!!rect && rect.bottom + hauteurMenuEstimee > limiteBasse);
  }, [ouvert]);

  useEffect(() => {
    if (!ouvert) return;

    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ouvert, onToggle]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          "flex size-6 shrink-0 items-center justify-center rounded text-texte-discret transition-all",
          "hover:bg-surface-2 hover:text-texte",
          // Toujours atteignable au doigt : `group-hover` n'existe pas au tactile.
          ouvert ? "opacity-100 bg-surface-2 text-texte" : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100",
        )}
        aria-label="Options"
        aria-expanded={ouvert}
      >
        <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>

      {ouvert && (
        <div
          className={cx(
            "apparition absolute right-0 z-50 min-w-[10rem] overflow-hidden rounded-lg border border-bordure bg-surface shadow-[var(--ombre-surcouche)]",
            versLeHaut ? "bottom-7" : "top-7",
          )}
        >
          <button
            onClick={() => { onToggle(); onAttacherImage(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-surface-2 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-texte-discret" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="m21 15-5-5L5 21" />
            </svg>
            Attacher une image
          </button>
          <button
            onClick={() => { onToggle(); onRenommer(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-surface-2 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-texte-discret" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
            Renommer
          </button>
          <div className="mx-2 my-0.5 h-px bg-bordure" />
          <button
            onClick={() => { onToggle(); onSupprimer(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs text-danger hover:bg-danger-faible transition-colors"
          >
            <svg viewBox="0 0 24 24" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            </svg>
            Supprimer
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sous-composant : texte défilant au survol s'il est tronqué          */
/* ------------------------------------------------------------------ */

function TexteScrollable({ texte, fait }: { texte: string; fait: boolean }) {
  const exterieurRef = useRef<HTMLSpanElement>(null);
  const interieurRef = useRef<HTMLSpanElement>(null);
  const [deborde, setDeborde] = useState(false);

  useEffect(() => {
    const ext = exterieurRef.current;
    const int = interieurRef.current;
    if (!ext || !int) return;
    setDeborde(int.scrollWidth > ext.clientWidth + 2);
  }, [texte]);

  return (
    <span
      ref={exterieurRef}
      className={cx(
        "group/txt relative min-w-0 flex-1 overflow-hidden text-sm",
        fait && "text-texte-discret line-through",
      )}
      title={texte}
    >
      <span
        ref={interieurRef}
        className={cx(
          "inline-block whitespace-nowrap",
          deborde && "hover:animate-[defilement_12s_linear_infinite]",
        )}
      >
        {texte}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Sous-composant : galerie d'images                                   */
/* ------------------------------------------------------------------ */

function GalerieImages({
  images,
  libelle,
  onSupprimer,
}: {
  images: string[];
  libelle: string;
  onSupprimer: (url: string) => void;
}) {
  const [agrandie, setAgrandie] = useState<string | null>(null);

  useEffect(() => {
    if (!agrandie) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAgrandie(null);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [agrandie]);

  if (!images.length) return null;

  const alt = `Capture attachée à « ${libelle} »`;

  return (
    <>
      <div className="flex flex-wrap gap-1.5 px-4 pb-2 pt-0.5 pl-[4.5rem]">
        {images.map((url) => (
          <div key={url} className="group/img relative">
            <button
              onClick={() => setAgrandie(url)}
              className="block overflow-hidden rounded-md border border-bordure transition-shadow hover:shadow-md"
              aria-label={`Agrandir : ${alt}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={alt} className="h-12 w-auto max-w-[6rem] object-cover" />
            </button>
            <button
              onClick={() => onSupprimer(url)}
              className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-danger text-white opacity-0 shadow transition-opacity group-hover/img:opacity-100 focus-visible:opacity-100"
              aria-label="Retirer l'image"
            >
              <svg viewBox="0 0 24 24" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Vue agrandie */}
      {agrandie && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setAgrandie(null)}
          role="dialog"
          aria-modal
          aria-label={alt}
        >
          <div className="apparition relative max-h-[85vh] max-w-[85vw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={agrandie} alt={alt} className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl" />
            <button
              onClick={() => setAgrandie(null)}
              className="absolute -right-3 -top-3 flex size-8 items-center justify-center rounded-full bg-surface text-texte shadow-lg border border-bordure"
              aria-label="Fermer l'aperçu"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Composant principal                                                 */
/* ------------------------------------------------------------------ */

/** Ordre d'affichage : les tâches faites descendent, le reste suit `ordre`. */
function trier(todos: DevTodo[]): DevTodo[] {
  return [...todos].sort((a, b) =>
    a.fait === b.fait ? a.ordre - b.ordre : a.fait ? 1 : -1,
  );
}

export function DevTodo() {
  const [ouvert, setOuvert] = useState(false);
  const [todos, setTodos] = useState<DevTodo[]>([]);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [texte, setTexte] = useState("");
  const [priorite, setPriorite] = useState<Priorite>("moyenne");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [renommageId, setRenommageId] = useState<string | null>(null);
  const [renommageTexte, setRenommageTexte] = useState("");
  const [menuOuvertId, setMenuOuvertId] = useState<string | null>(null);
  const modaleRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTodoId, setUploadTodoId] = useState<string | null>(null);

  const liste = useMemo(() => trier(todos), [todos]);

  const charger = useCallback(async () => {
    setChargement(true);
    const { donnees, erreur } = await api.lister();
    if (donnees) setTodos(donnees);
    setErreur(erreur);
    setChargement(false);
  }, []);

  // Le chargement est déclenché à l'ouverture (événement), pas depuis un effet :
  // un `setState` synchrone dans un effet provoque un rendu en cascade.
  const basculer = () => {
    const prochain = !ouvert;
    setOuvert(prochain);
    if (prochain) void charger();
  };

  /* Fermeture au clic extérieur / Échap */
  useEffect(() => {
    if (!ouvert) return;
    function handleClick(e: MouseEvent) {
      if (modaleRef.current && !modaleRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (menuOuvertId) { setMenuOuvertId(null); return; }
      if (renommageId) { setRenommageId(null); return; }
      setOuvert(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ouvert, renommageId, menuOuvertId]);

  /* Ajout */
  const ajouterTodo = async () => {
    const t = texte.trim();
    if (!t) return;
    const { donnees, erreur } = await mesurerInteraction("clic", "Ajouter TODO", () =>
      api.creer(t, priorite),
    );
    setErreur(erreur);
    if (donnees) {
      setTodos((prev) => [...prev, donnees]);
      setTexte("");
    }
  };

  /** Remplace une ligne à partir de la réponse du serveur. */
  const remplacer = (maj: DevTodo) =>
    setTodos((prev) => prev.map((t) => (t.id === maj.id ? maj : t)));

  const toggleFait = async (todo: DevTodo) => {
    const { donnees, erreur } = await mesurerInteraction("clic", "Basculer TODO", () =>
      api.modifier(todo.id, { fait: !todo.fait }),
    );
    setErreur(erreur);
    if (donnees) remplacer(donnees);
  };

  const supprimer = async (id: string) => {
    const { erreur } = await mesurerInteraction("clic", "Supprimer TODO", () =>
      api.supprimer(id),
    );
    setErreur(erreur);
    if (!erreur) setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  /* Renommage */
  const demarrerRenommage = (todo: DevTodo) => {
    setRenommageId(todo.id);
    setRenommageTexte(todo.texte);
  };

  const validerRenommage = async () => {
    const id = renommageId;
    const nouveau = renommageTexte.trim();
    setRenommageId(null);
    if (!id || !nouveau) return;
    const { donnees, erreur } = await api.modifier(id, { texte: nouveau });
    setErreur(erreur);
    if (donnees) remplacer(donnees);
  };

  /* Images */
  const lancerUpload = (todoId: string) => {
    setUploadTodoId(todoId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    const todoId = uploadTodoId;
    e.target.value = "";
    setUploadTodoId(null);
    if (!fichier || !todoId) return;

    const televerse = await api.televerser(fichier);
    if (!televerse.donnees) {
      setErreur(televerse.erreur);
      return;
    }

    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;
    const { donnees, erreur } = await api.modifier(todoId, {
      images: [...(todo.images ?? []), televerse.donnees.url],
    });
    setErreur(erreur);
    if (donnees) remplacer(donnees);
  };

  const retirerImage = async (todoId: string, imageUrl: string) => {
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;
    const { donnees, erreur } = await api.modifier(todoId, {
      images: (todo.images ?? []).filter((u) => u !== imageUrl),
    });
    setErreur(erreur);
    if (donnees) remplacer(donnees);
  };

  /* ---------------------------------------------------------------- */
  /* Glisser-déposer                                                   */
  /* ---------------------------------------------------------------- */

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== dragId) setDragOverId(id);
  };

  const finDrag = () => {
    setDragId(null);
    setDragOverId(null);
  };

  const handleDrop = async (surId: string) => {
    const deId = dragId;
    finDrag();
    if (!deId || deId === surId) return;

    // Réordonnancement sur la liste *affichée* : c'est elle que l'on manipule.
    const copie = [...liste];
    const deIndex = copie.findIndex((t) => t.id === deId);
    const surIndex = copie.findIndex((t) => t.id === surId);
    if (deIndex === -1 || surIndex === -1) return;

    const [deplace] = copie.splice(deIndex, 1);
    copie.splice(surIndex, 0, deplace);

    const reordonne = copie.map((t, i) => ({ ...t, ordre: i }));
    const avant = todos;
    setTodos(reordonne);

    // Une seule requête : renuméroter en N appels laisserait un ordre incohérent
    // si l'un d'eux échouait.
    const { erreur } = await mesurerInteraction("clic", "Réordonner TODO", () =>
      api.reordonner(reordonne.map(({ id, ordre }) => ({ id, ordre }))),
    );
    if (erreur) {
      setErreur(erreur);
      setTodos(avant);
    }
  };

  const nonFaites = todos.filter((t) => !t.fait).length;
  const faites = todos.length - nonFaites;
  const prioInfo = (p: Priorite) => PRIORITES.find((pr) => pr.valeur === p) ?? PRIORITES[1];

  return (
    <>
      {/* Champ fichier caché, partagé par toutes les lignes */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Bouton flottant ── */}
      {/* Sur mobile, au-dessus de la barre de navigation : en haut à droite il
          recouvrirait la bascule de thème de la barre supérieure. */}
      <button
        onClick={basculer}
        className={cx(
          "fixed bottom-20 right-4 z-50 flex size-11 items-center justify-center rounded-full shadow-lg transition-all duration-200",
          "lg:bottom-auto lg:top-4",
          "bg-primaire text-primaire-contraste hover:bg-primaire-fort hover:shadow-xl",
          "hover:scale-105 active:scale-95",
          ouvert && "ring-2 ring-primaire/40 ring-offset-2 ring-offset-fond",
        )}
        aria-label={ouvert ? "Fermer les TODOs" : "Ouvrir les TODOs"}
        aria-expanded={ouvert}
        title="TODOs dev"
      >
        <IconeTodo className="size-5" />
        {nonFaites > 0 && !ouvert && (
          <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-danger text-[0.625rem] font-bold text-white shadow">
            {nonFaites > 9 ? "9+" : nonFaites}
          </span>
        )}
      </button>

      {/* ── Modale ── */}
      {ouvert && (
        <div className="fixed inset-0 z-40 flex items-end justify-center p-4 pb-32 lg:items-start lg:justify-end lg:pb-4 lg:pt-18">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px]" aria-hidden />

          <div
            ref={modaleRef}
            role="dialog"
            aria-modal
            aria-label="TODOs dev"
            className="apparition relative flex max-h-[calc(100vh-10rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-bordure bg-surface shadow-[var(--ombre-surcouche)] lg:max-h-[calc(100vh-6rem)]"
          >
            {/* En-tête */}
            <div className="flex items-center justify-between border-b border-bordure px-4 py-3">
              <div className="flex items-center gap-2">
                <IconeTodo className="size-5 text-primaire" />
                <h2 className="font-serif text-[1.0625rem] font-medium tracking-tight">
                  TODOs dev
                </h2>
                {nonFaites > 0 && (
                  <span className="flex items-center justify-center rounded-full bg-danger/15 px-2 py-0.5 text-[0.625rem] font-semibold text-danger">
                    {nonFaites} restante{nonFaites > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <button
                onClick={() => setOuvert(false)}
                className="flex size-7 items-center justify-center rounded-md text-texte-discret transition-colors hover:bg-surface-2 hover:text-texte"
                aria-label="Fermer"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Formulaire d'ajout */}
            <div className="border-b border-bordure px-4 py-3">
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ajouterTodo();
                    }
                  }}
                  maxLength={500}
                  placeholder="Nouvelle TODO…"
                  aria-label="Nouvelle TODO"
                  className="min-w-0 flex-1 rounded-md border border-bordure bg-fond px-3 py-1.5 text-sm text-texte placeholder:text-texte-discret focus:border-primaire focus:outline-none focus:ring-1 focus:ring-primaire/30"
                />
                <select
                  value={priorite}
                  onChange={(e) => setPriorite(e.target.value as Priorite)}
                  aria-label="Priorité"
                  className="rounded-md border border-bordure bg-fond px-2 py-1.5 text-xs font-medium text-texte-attenue focus:border-primaire focus:outline-none focus:ring-1 focus:ring-primaire/30"
                >
                  {PRIORITES.map((p) => (
                    <option key={p.valeur} value={p.valeur}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={ajouterTodo}
                  disabled={!texte.trim()}
                  aria-label="Ajouter"
                  className="inline-flex items-center justify-center rounded-md bg-primaire px-3 py-1.5 text-sm font-medium text-primaire-contraste transition-colors hover:bg-primaire-fort disabled:opacity-40 disabled:pointer-events-none"
                >
                  +
                </button>
              </div>
            </div>

            {/* Erreur */}
            {erreur && (
              <div
                role="status"
                className="flex items-start gap-2 border-b border-bordure bg-danger-faible px-4 py-2 text-xs text-danger"
              >
                <span className="flex-1">{erreur}</span>
                <button
                  onClick={() => setErreur(null)}
                  className="shrink-0 underline underline-offset-2 hover:no-underline"
                >
                  Masquer
                </button>
              </div>
            )}

            {/* Liste */}
            <div className="flex-1 overflow-y-auto">
              {chargement ? (
                <div className="flex items-center justify-center py-10 text-sm text-texte-discret">
                  Chargement…
                </div>
              ) : liste.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                  <IconeTodo className="mb-2 size-8 text-texte-discret opacity-40" />
                  <p className="text-sm font-medium text-texte-attenue">Aucune TODO</p>
                  <p className="mt-1 text-xs text-texte-discret">
                    Ajoutez une tâche pour commencer
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-bordure/50">
                  {liste.map((todo) => {
                    const info = prioInfo(todo.priorite);
                    const estDrag = dragId === todo.id;
                    const estSurvole = dragOverId === todo.id;
                    const enRenommage = renommageId === todo.id;
                    return (
                      <li key={todo.id}>
                        <div
                          draggable={!enRenommage}
                          onDragStart={() => setDragId(todo.id)}
                          onDragOver={(e) => handleDragOver(e, todo.id)}
                          onDragLeave={() => setDragOverId(null)}
                          onDrop={() => handleDrop(todo.id)}
                          onDragEnd={finDrag}
                          onContextMenu={(e) => {
                            if (!enRenommage) {
                              e.preventDefault();
                              setMenuOuvertId(todo.id);
                            }
                          }}
                          className={cx(
                            "group flex items-center gap-2 px-4 py-2.5 transition-all duration-150",
                            todo.fait && "opacity-50 bg-surface-2/30",
                            estDrag && "opacity-30",
                            estSurvole && "bg-primaire-faible border-l-2 border-l-primaire",
                            !estDrag && !estSurvole && !todo.fait && "hover:bg-surface-2/60",
                          )}
                        >
                          {/* Poignée */}
                          <span className="cursor-grab text-texte-discret opacity-0 transition-opacity group-hover:opacity-60 active:cursor-grabbing">
                            <IconeGrip className="size-3.5" />
                          </span>

                          {/* Case à cocher */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFait(todo);
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className={cx(
                              "flex size-4.5 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer",
                              todo.fait
                                ? "border-succes/50 bg-succes/20 text-succes"
                                : "border-bordure-forte bg-surface hover:border-primaire",
                            )}
                            aria-pressed={todo.fait}
                            aria-label={todo.fait ? "Marquer à faire" : "Marquer fait"}
                          >
                            {todo.fait && (
                              <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m5 12.5 4.5 4.5L19 7.5" />
                              </svg>
                            )}
                          </button>

                          {/* Pastille de priorité */}
                          <span
                            className={cx("size-2 shrink-0 rounded-full", info.pastille)}
                            title={`Priorité ${info.label.toLowerCase()}`}
                          />

                          {/* Texte, ou champ de renommage */}
                          {enRenommage ? (
                            <input
                              autoFocus
                              type="text"
                              value={renommageTexte}
                              onChange={(e) => setRenommageTexte(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") validerRenommage();
                                if (e.key === "Escape") setRenommageId(null);
                              }}
                              onBlur={validerRenommage}
                              maxLength={500}
                              aria-label="Renommer la TODO"
                              className="min-w-0 flex-1 rounded border border-primaire bg-fond px-2 py-0.5 text-sm text-texte focus:outline-none focus:ring-1 focus:ring-primaire/30"
                            />
                          ) : (
                            <TexteScrollable texte={todo.texte} fait={todo.fait} />
                          )}

                          {todo.auteur && (
                            <span
                              className="hidden shrink-0 text-[0.625rem] text-texte-discret lg:inline"
                              title={`Ajoutée par ${todo.auteur}`}
                            >
                              {todo.auteur.split(" ")[0]}
                            </span>
                          )}

                          <MenuTroisPoints
                            ouvert={menuOuvertId === todo.id}
                            onToggle={() => setMenuOuvertId(menuOuvertId === todo.id ? null : todo.id)}
                            onRenommer={() => demarrerRenommage(todo)}
                            onAttacherImage={() => lancerUpload(todo.id)}
                            onSupprimer={() => supprimer(todo.id)}
                          />
                        </div>

                        <GalerieImages
                          images={todo.images ?? []}
                          libelle={todo.texte}
                          onSupprimer={(url) => retirerImage(todo.id, url)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Pied — résumé */}
            {liste.length > 0 && (
              <div className="border-t border-bordure px-4 py-2 text-[0.6875rem] text-texte-discret">
                {liste.length} tâche{liste.length > 1 ? "s" : ""} · {faites} terminée{faites > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
