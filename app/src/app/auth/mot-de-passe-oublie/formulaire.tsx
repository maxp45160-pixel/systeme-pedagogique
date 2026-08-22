"use client";

import { useState } from "react";
import Link from "next/link";
import { createNavigateurClient } from "@/lib/supabase/client";
import { BandeauInfo, Bouton } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";

/**
 * Demande du lien de redéfinition.
 *
 * `resetPasswordForEmail` répond de la même façon que l'adresse existe ou
 * non : on affiche la même confirmation dans les deux cas, pour ne pas
 * transformer l'écran en sonde d'énumération de comptes. Seules les erreurs
 * réellement bloquantes (adresse mal formée, limite d'envoi atteinte) sont
 * montrées.
 */
export function FormulaireOubli() {
  const [courriel, setCourriel] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoye, setEnvoye] = useState(false);

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createNavigateurClient();
    if (!supabase) return;
    setEnCours(true);
    setErreur(null);

    // Le lien repasse par l'échange de code existant (`/auth/callback`), qui
    // établit la session avant de mener à la page de redéfinition. Un seul
    // chemin d'échange, comme pour l'inscription et Google.
    const retour = new URL("/auth/callback", window.location.origin);
    retour.searchParams.set("suite", "/auth/nouveau-mot-de-passe");

    const { error } = await supabase.auth.resetPasswordForEmail(courriel, {
      redirectTo: retour.toString(),
    });
    if (error) {
      setErreur(error.message);
      setEnCours(false);
      return;
    }
    setEnCours(false);
    setEnvoye(true);
  }

  if (envoye) {
    return (
      <div className="space-y-4">
        <BandeauInfo ton="succes" taille="compacte">
          <p className="leading-relaxed text-succes">
            Si un compte existe pour cette adresse, un lien vient de partir.
            Vérifiez votre boîte — le lien expire au bout d&apos;une heure.
          </p>
        </BandeauInfo>
        <p className="text-center">
          <Link
            href="/login"
            className="text-xs text-texte-attenue underline-offset-2 transition-colors hover:text-texte hover:underline"
          >
            Retour à la connexion
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      {erreur && (
        <BandeauInfo ton="danger" taille="compacte">
          <p className="leading-relaxed text-danger">{erreur}</p>
        </BandeauInfo>
      )}

      <Champ
        id="courriel-oubli"
        label="Adresse e-mail"
        type="email"
        requis
        autoComplete="email"
        value={courriel}
        onChange={(e) => setCourriel(e.target.value)}
        placeholder="vous@exemple.fr"
      />

      <Bouton type="submit" variante="principal" className="w-full" enChargement={enCours}>
        Recevoir le lien
      </Bouton>

      <p className="text-center">
        <Link
          href="/login"
          className="text-xs text-texte-attenue underline-offset-2 transition-colors hover:text-texte hover:underline"
        >
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
