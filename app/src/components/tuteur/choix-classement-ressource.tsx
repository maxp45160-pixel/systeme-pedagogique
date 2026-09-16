"use client";

import { useId, useState } from "react";
import { Bouton } from "@/components/ui/primitives";
import type { ContexteOrganisationDepot } from "@/lib/documents/organisation-depot";
import { cheminDomaineClassement } from "@/lib/documents/classement-ressources";

export type ClassementSaisi = { destination: string; nom: string; parentId: string; usage: string; annee: string; sousDomaine?: boolean };
type Domaines = ContexteOrganisationDepot["domaines"];
const champ = "min-h-11 w-full rounded-lg border border-bordure-controle bg-surface px-3 py-2 text-sm text-texte focus-visible:outline-2 focus-visible:outline-primaire";

export function CarteClassementRessource({ choix, domaines, bloque, provenance, onModifier }: { choix: ClassementSaisi; domaines: Domaines; bloque: boolean; provenance: string; onModifier: () => void }) {
  const aPreciser = choix.destination === "nouveau" && choix.usage === "module" && !choix.annee;
  const chemin = choix.destination === "nouveau"
    ? [...(choix.parentId ? cheminDomaineClassement(choix.parentId, domaines).split(" › ") : []), choix.nom || "À nommer"]
    : choix.destination ? cheminDomaineClassement(choix.destination, domaines).split(" › ") : [];
  return <div className="space-y-3">
    <div className="flex items-start justify-between gap-4">
      {chemin.length ? <dl className="min-w-0 space-y-2"><div><dt className="text-xs text-texte-attenue">Domaine</dt><dd className="break-words text-base font-semibold">{chemin[0]}</dd></div>{chemin.length > 1 && <div><dt className="text-xs text-texte-attenue">Sous-domaine</dt><dd className="break-words text-sm font-medium">{chemin.slice(1).join(" › ")}</dd></div>}</dl> : <p className="text-sm text-texte-attenue">Choisissez où ranger ce document.</p>}
      <Bouton type="button" variante="secondaire" taille="petite" disabled={bloque} onClick={onModifier}>{aPreciser ? "Choisir le type de matière" : chemin.length ? "Modifier" : "Choisir"}</Bouton>
    </div>
    <p className="text-xs text-texte-attenue">{provenance}</p>
    {choix.destination === "nouveau" && <p className="text-xs text-texte-attenue">{choix.usage === "continu" ? "Matière suivie dans la durée" : choix.usage === "module" ? `Cours d’une année${choix.annee ? ` · ${choix.annee}` : " · année à préciser avant de confirmer"}` : "Organisation de documents · aucune compétence obligatoire."}</p>}
  </div>;
}

export function EditeurClassementRessource({ choix, domaines, bloque, onChanger, onReduire }: { choix: ClassementSaisi; domaines: Domaines; bloque: boolean; onChanger: (choix: ClassementSaisi) => void; onReduire: () => void }) {
  const groupe = useId();
  const saisie = choix;
  function setSaisie(changer: (avant: ClassementSaisi) => ClassementSaisi) { onChanger(changer(saisie)); }
  const [mode, setMode] = useState<"existant" | "nouveau" | "enfant">(() => choix.destination === "nouveau" ? choix.parentId || choix.sousDomaine ? "enfant" : "nouveau" : "existant");
  const [recherche, setRecherche] = useState("");
  const liste = domaines.filter((d) => cheminDomaineClassement(d.id, domaines).toLocaleLowerCase("fr").includes(recherche.trim().toLocaleLowerCase("fr")));
  const attente = bloque;
  function changerMode(suivant: "existant" | "nouveau" | "enfant") {
    setMode(suivant); setRecherche("");
    setSaisie((avant) => ({ ...avant, destination: suivant === "existant" ? choix.destination === "nouveau" ? "" : choix.destination : "nouveau", usage: avant.usage || "indetermine", parentId: suivant === "enfant" ? avant.parentId : "", sousDomaine: suivant === "enfant" }));
  }
  return <div className="space-y-4">
    <div className="flex flex-wrap gap-2">
      <Bouton type="button" taille="petite" variante={mode === "existant" ? "secondaire" : "discret"} aria-pressed={mode === "existant"} disabled={attente} onClick={() => changerMode("existant")}>Domaine existant</Bouton>
      <Bouton type="button" taille="petite" variante={mode === "nouveau" ? "secondaire" : "discret"} aria-pressed={mode === "nouveau"} disabled={attente} onClick={() => changerMode("nouveau")}>Nouveau domaine</Bouton>
      <Bouton type="button" taille="petite" variante={mode === "enfant" ? "secondaire" : "discret"} aria-pressed={mode === "enfant"} disabled={attente || !domaines.length} onClick={() => changerMode("enfant")}>Nouveau sous-domaine</Bouton>
    </div>
    {mode !== "existant" && <label className="block space-y-1.5 text-sm"><span className="font-medium">{mode === "enfant" ? "Nom du sous-domaine" : "Nom du domaine"}</span><input className={champ} value={saisie.nom} maxLength={80} disabled={attente} placeholder={mode === "enfant" ? "Ex. Calcul algébrique" : "Ex. Mathématiques"} onChange={(e) => setSaisie((avant) => ({ ...avant, nom: e.target.value }))} /></label>}
    {(mode === "existant" || mode === "enfant") && <fieldset disabled={attente} className="space-y-2">
      <legend className="mb-2 text-sm font-medium">{mode === "enfant" ? "Dans quel domaine ?" : "Choisissez un domaine"}</legend>
      {domaines.length > 5 && <input type="search" className={champ} value={recherche} aria-label="Rechercher un domaine" placeholder="Rechercher une matière…" onChange={(e) => setRecherche(e.target.value)} />}
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-bordure p-2">
        {liste.map((d) => <label key={d.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-primaire/5"><input type="radio" name={`${groupe}-domaine`} className="size-4 shrink-0 accent-primaire" checked={(mode === "enfant" ? saisie.parentId : saisie.destination) === d.id} onChange={() => setSaisie((avant) => ({ ...avant, ...(mode === "enfant" ? { parentId: d.id } : { destination: d.id }) }))} /><span>{cheminDomaineClassement(d.id, domaines)}</span></label>)}
        {!liste.length && <p className="p-2 text-sm text-texte-attenue">{domaines.length ? "Aucun domaine ne correspond à cette recherche." : "Vous n’avez pas encore de domaine. Choisissez Nouveau domaine."}</p>}
      </div>
    </fieldset>}
    {mode !== "existant" && <fieldset disabled={attente} className="space-y-2"><legend className="mb-2 text-sm font-medium">Quel type de matière ?</legend>
      <label className="flex min-h-11 cursor-pointer gap-3 rounded-lg border border-bordure p-3 text-sm"><input type="radio" name={`${groupe}-usage`} className="mt-0.5 size-4 shrink-0 accent-primaire" checked={!saisie.usage || saisie.usage === "indetermine"} onChange={() => setSaisie((avant) => ({ ...avant, usage: "indetermine", annee: "" }))} /><span><strong className="block font-medium">Organisation de documents</strong><span className="text-xs text-texte-attenue">Sans compétence obligatoire. Vous pourrez préciser le contexte d’études plus tard.</span></span></label>
      <label className="flex min-h-11 cursor-pointer gap-3 rounded-lg border border-bordure p-3 text-sm"><input type="radio" name={`${groupe}-usage`} className="mt-0.5 size-4 shrink-0 accent-primaire" checked={saisie.usage === "continu"} onChange={() => setSaisie((avant) => ({ ...avant, usage: "continu", annee: "" }))} /><span><strong className="block font-medium">Matière suivie dans la durée</strong><span className="text-xs text-texte-attenue">Pour progresser au fil du temps, sans année de fin.</span></span></label>
      <label className="flex min-h-11 cursor-pointer gap-3 rounded-lg border border-bordure p-3 text-sm"><input type="radio" name={`${groupe}-usage`} className="mt-0.5 size-4 shrink-0 accent-primaire" checked={saisie.usage === "module"} onChange={() => setSaisie((avant) => ({ ...avant, usage: "module" }))} /><span><strong className="block font-medium">Cours d’une année</strong><span className="text-xs text-texte-attenue">Pour une matière rattachée à votre année d’études.</span></span></label>
      {saisie.usage === "module" && <label className="block space-y-1.5 text-sm"><span>Année d’études</span><input className={champ} value={saisie.annee} maxLength={100} placeholder="Ex. 2026–2027" onChange={(e) => setSaisie((avant) => ({ ...avant, annee: e.target.value }))} /></label>}
    </fieldset>}
    <Bouton type="button" variante="discret" taille="petite" disabled={attente} onClick={onReduire}>Réduire les options</Bouton>
  </div>;
}
