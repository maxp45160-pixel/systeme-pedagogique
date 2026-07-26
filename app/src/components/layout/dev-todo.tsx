"use client";

/**
 * Widget TODO de développement — bouton flottant + modale.
 *
 * Les TODOs sont partagées entre tous les utilisateurs (pas de `user_id`).
 * Le drag & drop utilise l'API HTML5 native pour éviter toute dépendance.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui/primitives";
import { IconeTodo, IconeGrip } from "@/components/ui/icones";

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

async function fetchTodos(): Promise<DevTodo[]> {
  const res = await fetch("/api/dev-todos");
  if (!res.ok) return [];
  return res.json();
}

async function creerTodo(texte: string, priorite: Priorite): Promise<DevTodo | null> {
  const res = await fetch("/api/dev-todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ texte, priorite }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function majTodo(id: string, champs: Partial<DevTodo>): Promise<DevTodo | null> {
  const res = await fetch("/api/dev-todos", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, ...champs }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function supprimerTodo(id: string): Promise<boolean> {
  const res = await fetch(`/api/dev-todos?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  return res.ok;
}

async function uploaderImage(todoId: string, fichier: File): Promise<string | null> {
  const form = new FormData();
  form.append("fichier", fichier);
  form.append("todoId", todoId);
  const res = await fetch("/api/dev-todos/upload", { method: "POST", body: form });
  if (!res.ok) return null;
  const data = await res.json();
  return data.url as string;
}

/* ------------------------------------------------------------------ */
/* Sous-composant : menu ⋯                                            */
/* ------------------------------------------------------------------ */

function MenuTroisPoints({
  onRenommer,
  onAttacherImage,
  onSupprimer,
}: {
  onRenommer: () => void;
  onAttacherImage: () => void;
  onSupprimer: () => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [ouvert]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOuvert((v) => !v); }}
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          "flex size-6 shrink-0 items-center justify-center rounded text-texte-discret transition-all",
          "hover:bg-surface-2 hover:text-texte",
          ouvert ? "opacity-100 bg-surface-2 text-texte" : "opacity-0 group-hover:opacity-100",
        )}
        aria-label="Options"
      >
        <svg viewBox="0 0 24 24" className="size-3.5" fill="currentColor">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>

      {ouvert && (
        <div className="apparition absolute right-0 top-7 z-50 min-w-[10rem] overflow-hidden rounded-lg border border-bordure bg-surface shadow-[var(--ombre-surcouche)]">
          <button
            onClick={() => { setOuvert(false); onAttacherImage(); }}
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
            onClick={() => { setOuvert(false); onRenommer(); }}
            className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs hover:bg-surface-2 transition-colors"
          >
            <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-texte-discret" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
            Renommer
          </button>
          <div className="mx-2 my-0.5 h-px bg-bordure" />
          <button
            onClick={() => { setOuvert(false); onSupprimer(); }}
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
/* Sous-composant : texte scrollable au hover                          */
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
  onSupprimer,
}: {
  images: string[];
  onSupprimer: (url: string) => void;
}) {
  const [agrandie, setAgrandie] = useState<string | null>(null);

  if (!images.length) return null;

  return (
    <>
      <div className="flex flex-wrap gap-1.5 px-4 pb-2 pt-0.5 pl-[4.5rem]">
        {images.map((url) => (
          <div key={url} className="group/img relative">
            <button
              onClick={() => setAgrandie(url)}
              className="block overflow-hidden rounded-md border border-bordure transition-shadow hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="h-12 w-auto max-w-[6rem] object-cover"
              />
            </button>
            <button
              onClick={() => onSupprimer(url)}
              className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-danger text-white opacity-0 shadow transition-opacity group-hover/img:opacity-100"
              aria-label="Retirer l'image"
            >
              <svg viewBox="0 0 24 24" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {agrandie && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setAgrandie(null)}
        >
          <div className="apparition relative max-h-[85vh] max-w-[85vw]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={agrandie} alt="" className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain shadow-2xl" />
            <button
              onClick={() => setAgrandie(null)}
              className="absolute -right-3 -top-3 flex size-8 items-center justify-center rounded-full bg-surface text-texte shadow-lg border border-bordure"
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

export function DevTodo() {
  const [ouvert, setOuvert] = useState(false);
  const [todos, setTodos] = useState<DevTodo[]>([]);
  const [chargement, setChargement] = useState(false);
  const [texte, setTexte] = useState("");
  const [priorite, setPriorite] = useState<Priorite>("moyenne");
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [renommageId, setRenommageId] = useState<string | null>(null);
  const [renommageTexte, setRenommageTexte] = useState("");
  const modaleRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTodoId, setUploadTodoId] = useState<string | null>(null);

  /* Chargement initial */
  const charger = useCallback(async () => {
    setChargement(true);
    const data = await fetchTodos();
    setTodos(data.sort((a, b) => a.ordre - b.ordre));
    setChargement(false);
  }, []);

  useEffect(() => {
    if (ouvert) {
      charger();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [ouvert, charger]);

  /* Fermeture au clic extérieur */
  useEffect(() => {
    if (!ouvert) return;
    function handleClick(e: MouseEvent) {
      if (modaleRef.current && !modaleRef.current.contains(e.target as Node)) {
        setOuvert(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (renommageId) { setRenommageId(null); return; }
        setOuvert(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [ouvert, renommageId]);

  /* Ajout */
  const ajouterTodo = async () => {
    const t = texte.trim();
    if (!t) return;
    const nouveau = await creerTodo(t, priorite);
    if (nouveau) {
      setTodos((prev) => [...prev, nouveau]);
      setTexte("");
    }
  };

  /* Toggle fait/à faire */
  const toggleFait = async (todo: DevTodo) => {
    const result = await majTodo(todo.id, { fait: !todo.fait });
    if (result) {
      setTodos((prev) => prev.map((t) => (t.id === todo.id ? result : t)));
    }
  };

  /* Suppression */
  const supprimer = async (id: string) => {
    const ok = await supprimerTodo(id);
    if (ok) {
      setTodos((prev) => prev.filter((t) => t.id !== id));
    }
  };

  /* Renommage */
  const demarrerRenommage = (todo: DevTodo) => {
    setRenommageId(todo.id);
    setRenommageTexte(todo.texte);
  };

  const validerRenommage = async () => {
    if (!renommageId || !renommageTexte.trim()) return;
    const result = await majTodo(renommageId, { texte: renommageTexte.trim() });
    if (result) {
      setTodos((prev) => prev.map((t) => (t.id === renommageId ? result : t)));
    }
    setRenommageId(null);
  };

  /* Upload d'image */
  const lancerUpload = (todoId: string) => {
    setUploadTodoId(todoId);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    if (!fichier || !uploadTodoId) return;

    const url = await uploaderImage(uploadTodoId, fichier);
    if (url) {
      const todo = todos.find((t) => t.id === uploadTodoId);
      if (todo) {
        const nouvellesImages = [...(todo.images ?? []), url];
        const result = await majTodo(uploadTodoId, { images: nouvellesImages });
        if (result) {
          setTodos((prev) => prev.map((t) => (t.id === uploadTodoId ? result : t)));
        }
      }
    }
    // Reset file input
    e.target.value = "";
    setUploadTodoId(null);
  };

  const retirerImage = async (todoId: string, imageUrl: string) => {
    const todo = todos.find((t) => t.id === todoId);
    if (!todo) return;
    const nouvellesImages = (todo.images ?? []).filter((u) => u !== imageUrl);
    const result = await majTodo(todoId, { images: nouvellesImages });
    if (result) {
      setTodos((prev) => prev.map((t) => (t.id === todoId ? result : t)));
    }
  };

  /* Drag & Drop */
  const handleDragStart = (id: string) => {
    setDragId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (id !== dragId) setDragOverId(id);
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (surId: string) => {
    if (!dragId || dragId === surId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }

    const copie = [...todos];
    const deIndex = copie.findIndex((t) => t.id === dragId);
    const surIndex = copie.findIndex((t) => t.id === surId);
    if (deIndex === -1 || surIndex === -1) return;

    const [deplace] = copie.splice(deIndex, 1);
    copie.splice(surIndex, 0, deplace);

    const reordonne = copie.map((t, i) => ({ ...t, ordre: i }));
    setTodos(reordonne);
    setDragId(null);
    setDragOverId(null);

    await Promise.all(
      reordonne
        .filter((t, i) => t.ordre !== todos.find((o) => o.id === t.id)?.ordre || i !== todos.findIndex((o) => o.id === t.id))
        .map((t) => majTodo(t.id, { ordre: t.ordre })),
    );
  };

  const handleDragEnd = () => {
    setDragId(null);
    setDragOverId(null);
  };

  /* Compteur */
  const nonFaites = todos.filter((t) => !t.fait).length;

  /* Priorité info helper */
  const prioInfo = (p: Priorite) => PRIORITES.find((pr) => pr.valeur === p)!;

  return (
    <>
      {/* Input fichier caché (partagé) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Bouton flottant ── */}
      <button
        onClick={() => setOuvert((v) => !v)}
        className={cx(
          "fixed right-4 top-4 z-50 flex size-11 items-center justify-center rounded-full shadow-lg transition-all duration-200",
          "bg-primaire text-primaire-contraste hover:bg-primaire-fort hover:shadow-xl",
          "hover:scale-105 active:scale-95",
          ouvert && "ring-2 ring-primaire/40 ring-offset-2 ring-offset-fond",
        )}
        aria-label={ouvert ? "Fermer les TODOs" : "Ouvrir les TODOs"}
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
        <div className="fixed inset-0 z-40 flex items-start justify-end p-4 pt-18">
          {/* Overlay semi-transparent */}
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[2px]" aria-hidden />

          <div
            ref={modaleRef}
            className="apparition relative flex max-h-[calc(100vh-6rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-bordure bg-surface shadow-[var(--ombre-surcouche)]"
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
                  ref={inputRef}
                  type="text"
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ajouterTodo();
                    }
                  }}
                  placeholder="Nouvelle TODO…"
                  className="min-w-0 flex-1 rounded-md border border-bordure bg-fond px-3 py-1.5 text-sm text-texte placeholder:text-texte-discret focus:border-primaire focus:outline-none focus:ring-1 focus:ring-primaire/30"
                />
                <select
                  value={priorite}
                  onChange={(e) => setPriorite(e.target.value as Priorite)}
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
                  className="inline-flex items-center justify-center rounded-md bg-primaire px-3 py-1.5 text-sm font-medium text-primaire-contraste transition-colors hover:bg-primaire-fort disabled:opacity-40 disabled:pointer-events-none"
                >
                  +
                </button>
              </div>
            </div>

            {/* Liste des TODOs */}
            <div className="flex-1 overflow-y-auto">
              {chargement ? (
                <div className="flex items-center justify-center py-10 text-sm text-texte-discret">
                  Chargement…
                </div>
              ) : todos.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                  <IconeTodo className="mb-2 size-8 text-texte-discret opacity-40" />
                  <p className="text-sm font-medium text-texte-attenue">Aucune TODO</p>
                  <p className="mt-1 text-xs text-texte-discret">
                    Ajoutez une tâche pour commencer
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-bordure/50">
                  {[...todos]
                    .sort((a, b) => (a.fait === b.fait ? a.ordre - b.ordre : a.fait ? 1 : -1))
                    .map((todo) => {
                    const info = prioInfo(todo.priorite);
                    const estDrag = dragId === todo.id;
                    const estSurvole = dragOverId === todo.id;
                    const enRenommage = renommageId === todo.id;
                    return (
                      <li key={todo.id}>
                        <div
                          draggable={!enRenommage}
                          onDragStart={() => handleDragStart(todo.id)}
                          onDragOver={(e) => handleDragOver(e, todo.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={() => handleDrop(todo.id)}
                          onDragEnd={handleDragEnd}
                          className={cx(
                            "group flex items-center gap-2 px-4 py-2.5 transition-all duration-150",
                            todo.fait && "opacity-50 bg-surface-2/30",
                            estDrag && "opacity-30",
                            estSurvole && "bg-primaire-faible border-l-2 border-l-primaire",
                            !estDrag && !estSurvole && !todo.fait && "hover:bg-surface-2/60",
                          )}
                        >
                          {/* Grip */}
                          <span className="cursor-grab text-texte-discret opacity-0 transition-opacity group-hover:opacity-60 active:cursor-grabbing">
                            <IconeGrip className="size-3.5" />
                          </span>

                          {/* Checkbox */}
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
                            aria-label={todo.fait ? "Marquer à faire" : "Marquer fait"}
                          >
                            {todo.fait && (
                              <svg viewBox="0 0 24 24" className="size-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m5 12.5 4.5 4.5L19 7.5" />
                              </svg>
                            )}
                          </button>

                          {/* Pastille priorité */}
                          <span
                            className={cx("size-2 shrink-0 rounded-full", info.pastille)}
                            title={`Priorité ${info.label.toLowerCase()}`}
                          />

                          {/* Texte (scrollable au hover si tronqué) ou champ de renommage */}
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
                              className="min-w-0 flex-1 rounded border border-primaire bg-fond px-2 py-0.5 text-sm text-texte focus:outline-none focus:ring-1 focus:ring-primaire/30"
                            />
                          ) : (
                            <TexteScrollable texte={todo.texte} fait={todo.fait} />
                          )}

                          {/* Menu ⋯ */}
                          <MenuTroisPoints
                            onRenommer={() => demarrerRenommage(todo)}
                            onAttacherImage={() => lancerUpload(todo.id)}
                            onSupprimer={() => supprimer(todo.id)}
                          />
                        </div>

                        {/* Images attachées */}
                        <GalerieImages
                          images={todo.images ?? []}
                          onSupprimer={(url) => retirerImage(todo.id, url)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Pied — résumé */}
            {todos.length > 0 && (
              <div className="border-t border-bordure px-4 py-2 text-[0.6875rem] text-texte-discret">
                {todos.length} tâche{todos.length > 1 ? "s" : ""} · {todos.filter((t) => t.fait).length} terminée{todos.filter((t) => t.fait).length > 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
