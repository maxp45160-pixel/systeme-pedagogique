"use client";

import { useEffect, useRef, useState } from "react";
import { classesBouton, cx, Etiquette } from "@/components/ui/primitives";
import { Markdown } from "@/components/ui/markdown";
import { preparerPromptComplet } from "@/lib/tutor/actions";
import type { SectionContexte } from "@/lib/tutor/contexte";

/** Les sept modes rapides demandés. */
const MODES = [
  { cle: "explique", libelle: "Explique-moi", amorce: "Explique-moi " },
  { cle: "exercice", libelle: "Donne-moi un exercice", amorce: "Donne-moi un exercice sur " },
  { cle: "evalue", libelle: "Évalue-moi", amorce: "Évalue mon niveau sur " },
  { cle: "indice", libelle: "Donne-moi un indice", amorce: "Donne-moi un indice sur " },
  { cle: "corrige", libelle: "Corrige mon raisonnement", amorce: "Corrige mon raisonnement :\n\n" },
  { cle: "lacunes", libelle: "Fais le point sur mes lacunes", amorce: "Fais le point sur mes lacunes." },
  { cle: "projet", libelle: "Propose-moi un projet", amorce: "Propose-moi un projet sur " },
] as const;

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Etat {
  cleConfiguree: boolean;
  modele: string;
  manifeste: SectionContexte[];
  caracteresTotal: number;
}

export function ChatTuteur({
  competenceCiblee,
  modeDemo,
}: {
  competenceCiblee?: string;
  modeDemo: boolean;
}) {
  const [etat, setEtat] = useState<Etat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [saisie, setSaisie] = useState(
    competenceCiblee ? `Donne-moi un exercice sur ${competenceCiblee}.` : "",
  );
  const [enCours, setEnCours] = useState(false);
  const [avis, setAvis] = useState<{ ton: "info" | "alerte" | "danger"; texte: string } | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const zoneRef = useRef<HTMLDivElement>(null);
  const champRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/tutor")
      .then((r) => r.json())
      .then(setEtat)
      .catch(() =>
        setAvis({ ton: "danger", texte: "Impossible de lire l'état du contexte pédagogique." }),
      );
  }, []);

  useEffect(() => {
    zoneRef.current?.scrollTo({ top: zoneRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function envoyer(texte: string) {
    const contenu = texte.trim();
    if (!contenu || enCours) return;

    setAvis(null);
    setUsage(null);
    const historique: Message[] = [...messages, { role: "user", content: contenu }];
    setMessages([...historique, { role: "assistant", content: "" }]);
    setSaisie("");
    setEnCours(true);

    try {
      const reponse = await fetch("/api/tutor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: historique }),
      });

      if (!reponse.ok || !reponse.body) {
        const donnees = await reponse.json().catch(() => null);
        setMessages(historique);
        setAvis({
          ton: "alerte",
          texte:
            donnees?.message ??
            "Le tuteur n'a pas pu répondre. Utilise le mode « copier le contexte » ci-dessous.",
        });
        return;
      }

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";
      let accumule = "";

      // Lecture du flux SSE : découpage sur la ligne vide séparant les événements.
      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });

        let coupure: number;
        while ((coupure = tampon.indexOf("\n\n")) !== -1) {
          const brut = tampon.slice(0, coupure);
          tampon = tampon.slice(coupure + 2);

          const ligneEvenement = brut.split("\n").find((l) => l.startsWith("event: "));
          const ligneDonnees = brut.split("\n").find((l) => l.startsWith("data: "));
          if (!ligneEvenement || !ligneDonnees) continue;

          const type = ligneEvenement.slice(7).trim();
          let donnees: Record<string, unknown>;
          try {
            donnees = JSON.parse(ligneDonnees.slice(6));
          } catch {
            continue;
          }

          if (type === "texte") {
            accumule += String(donnees.delta ?? "");
            setMessages([...historique, { role: "assistant", content: accumule }]);
          } else if (type === "refus" || type === "erreur") {
            setAvis({
              ton: type === "refus" ? "alerte" : "danger",
              texte: String(donnees.message ?? "Erreur."),
            });
          } else if (type === "tronque") {
            setAvis({ ton: "info", texte: String(donnees.message ?? "") });
          } else if (type === "fin") {
            const u = donnees.usage as Record<string, number> | undefined;
            if (u) {
              setUsage(
                `${u.entree} jetons en entrée (dont ${u.cacheLu} lus en cache) · ${u.sortie} en sortie`,
              );
            }
          }
        }
      }

      if (accumule.trim() === "") {
        setMessages(historique);
      }
    } catch (e) {
      setMessages(historique);
      setAvis({
        ton: "danger",
        texte: e instanceof Error ? e.message : "Erreur réseau pendant la réponse.",
      });
    } finally {
      setEnCours(false);
    }
  }

  async function copierContexte() {
    try {
      const prompt = await preparerPromptComplet(saisie);
      await navigator.clipboard.writeText(prompt);
      setAvis({
        ton: "info",
        texte: `Contexte complet copié (${prompt.length.toLocaleString("fr-FR")} caractères). Colle-le dans Claude, puis saisis la réponse du tuteur dans l'exercice ou le journal.`,
      });
    } catch {
      setAvis({ ton: "danger", texte: "Copie impossible : le presse-papier est inaccessible." });
    }
  }

  const cleAbsente = etat !== null && !etat.cleConfiguree;

  return (
    <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
      <div className="lg:col-span-2">
        <div className="flex h-[min(70vh,620px)] flex-col rounded-carte border border-bordure bg-surface">
          {/* Conversation */}
          <div ref={zoneRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-sm font-medium">Le tuteur connaît ton profil</p>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-texte-attenue">
                  Il reçoit les protocoles du système et l&apos;état réel de tes 39 compétences,
                  calculé depuis tes preuves. Il ne peut pas modifier ton profil : il propose des
                  mises à jour que tu valides.
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={cx(m.role === "user" && "flex justify-end")}>
                <div
                  className={cx(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    m.role === "user"
                      ? "bg-primaire text-primaire-contraste"
                      : "border border-bordure bg-surface-2",
                  )}
                >
                  {m.role === "user" ? (
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  ) : m.content === "" ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-texte-attenue">
                      <span className="size-1.5 animate-pulse rounded-full bg-primaire" />
                      Le tuteur réfléchit…
                    </span>
                  ) : (
                    <Markdown contenu={m.content} />
                  )}
                </div>
              </div>
            ))}
          </div>

          {avis && (
            <div
              className={cx(
                "border-t px-4 py-2 text-xs",
                avis.ton === "info" && "border-info/30 bg-info-faible text-info",
                avis.ton === "alerte" && "border-alerte/30 bg-alerte-faible text-alerte",
                avis.ton === "danger" && "border-danger/30 bg-danger-faible text-danger",
              )}
            >
              {avis.texte}
            </div>
          )}

          {/* Saisie */}
          <div className="border-t border-bordure px-3 py-3">
            <div className="mb-2 flex flex-wrap gap-1">
              {MODES.map((m) => (
                <button
                  key={m.cle}
                  type="button"
                  disabled={enCours}
                  onClick={() => {
                    setSaisie(m.amorce);
                    champRef.current?.focus();
                  }}
                  className="rounded border border-bordure px-1.5 py-0.5 text-[0.6875rem] font-medium text-texte-attenue transition-colors hover:bg-surface-2 hover:text-texte disabled:opacity-50"
                >
                  {m.libelle}
                </button>
              ))}
            </div>

            <textarea
              ref={champRef}
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void envoyer(saisie);
                }
              }}
              rows={3}
              placeholder="Pose ta question, colle ton raisonnement, demande un exercice…"
              className="w-full resize-y rounded-md border border-bordure bg-surface px-3 py-2 text-sm placeholder:text-texte-discret focus:border-primaire focus:outline-none"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[0.625rem] text-texte-discret">
                Ctrl+Entrée pour envoyer
                {usage && <> · {usage}</>}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => void copierContexte()}
                  className={classesBouton("secondaire", "petite")}
                >
                  Copier le contexte
                </button>
                <button
                  type="button"
                  onClick={() => void envoyer(saisie)}
                  disabled={enCours || !saisie.trim() || cleAbsente}
                  className={classesBouton("principal", "petite")}
                >
                  {enCours ? "En cours…" : "Envoyer"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contexte réellement transmis */}
      <div className="space-y-4">
        <div className="rounded-carte border border-bordure bg-surface">
          <div className="border-b border-bordure px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={cx(
                  "size-1.5 rounded-full",
                  etat ? "bg-succes" : "bg-texte-discret",
                )}
              />
              <h2 className="text-[0.9375rem] font-semibold tracking-tight">
                {etat ? "Contexte pédagogique chargé" : "Chargement du contexte…"}
              </h2>
            </div>
            <p className="mt-1 text-xs text-texte-attenue">
              Contenu exact transmis au modèle à chaque message. Rien d&apos;autre n&apos;est
              connu du tuteur.
            </p>
          </div>

          {etat && (
            <>
              <ul className="divide-y divide-bordure">
                {etat.manifeste.map((s, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-2 px-4 py-2">
                    <span className="min-w-0 text-xs">
                      {s.nom}
                      {s.origine === "fichier" && (
                        <span className="ml-1 text-[0.625rem] text-texte-discret">fichier</span>
                      )}
                    </span>
                    <span className="chiffres shrink-0 text-[0.6875rem] text-texte-discret">
                      {(s.caracteres / 1000).toFixed(1)} k car.
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-bordure px-4 py-3 text-xs">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-texte-attenue">Total</span>
                  <span className="chiffres font-medium">
                    {(etat.caracteresTotal / 1000).toFixed(1)} k caractères
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-texte-attenue">Modèle</span>
                  <span className="font-mono text-[0.6875rem]">{etat.modele}</span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-texte-attenue">Clé API</span>
                  <Etiquette ton={etat.cleConfiguree ? "succes" : "alerte"}>
                    {etat.cleConfiguree ? "configurée" : "absente"}
                  </Etiquette>
                </div>
              </div>
            </>
          )}
        </div>

        {cleAbsente && (
          <div className="rounded-carte border border-alerte/30 bg-alerte-faible px-4 py-3 text-xs">
            <p className="font-medium text-alerte">Aucune clé API configurée</p>
            <p className="mt-1 text-texte-attenue">
              Le chat intégré est désactivé — il ne simulera pas de réponse. Deux options :
            </p>
            <ol className="mt-2 space-y-1 pl-4 text-texte-attenue">
              <li className="list-decimal">
                Utiliser <strong>« Copier le contexte »</strong> et coller le prompt dans Claude.
              </li>
              <li className="list-decimal">
                Créer <code className="font-mono">app/.env.local</code> avec{" "}
                <code className="font-mono">ANTHROPIC_API_KEY=…</code>, puis relancer le serveur.
              </li>
            </ol>
          </div>
        )}

        {modeDemo && (
          <div className="rounded-carte border border-bordure bg-surface-2 px-4 py-3 text-xs text-texte-attenue">
            Le mode démonstration est actif : le contexte transmis décrit le profil fictif, pas le
            tien.
          </div>
        )}

        <div className="rounded-carte border border-bordure bg-surface px-4 py-3 text-xs text-texte-attenue">
          <p className="font-medium text-texte">Ce que le tuteur ne peut pas faire</p>
          <ul className="mt-1.5 space-y-1">
            <li>· Écrire dans ton profil — il propose, tu valides.</li>
            <li>· Se souvenir d&apos;une séance absente du contexte ci-dessus.</li>
            <li>· Affirmer une maîtrise que les preuves ne soutiennent pas.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
