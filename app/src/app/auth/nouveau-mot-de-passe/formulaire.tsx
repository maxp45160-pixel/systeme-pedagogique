"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createNavigateurClient } from "@/lib/supabase/client";
import { BandeauInfo, Bouton } from "@/components/ui/primitives";
import { Champ } from "@/components/ui/champ";
import { validerRedefinition } from "@/lib/domain/reinitialisation-mot-de-passe";

/**
 * Redéfinition effective du mot de passe.
 *
 * Politique de sessions (ADR-100) : l'appareil qui vient de redéfinir le
 * mot de passe reste connecté — c'est lui qui vient de prouver la maîtrise
 * de la boîte mail. Toutes les autres sessions du compte sont révoquées
 * explicitement (`signOut` portée `others`) : un lien de redéfinition ne doit
 * jamais laisser une session oubliée sur un autre appareil.
 */
export function FormulaireNouveauMotDePasse() {
  const [motDePasse, setMotDePasse] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [erreurMotDePasse, setErreurMotDePasse] = useState<string | undefined>();
  const [erreurConfirmation, setErreurConfirmation] = useState<string | undefined>();
  const router = useRouter();

  const supabase = createNavigateurClient();

  async function soumettre(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;

    const verdict = validerRedefinition(motDePasse, confirmation);
    if (!verdict.valide) {
      setErreurMotDePasse(verdict.erreurMotDePasse);
      setErreurConfirmation(verdict.erreurConfirmation);
      return;
    }
    setErreurMotDePasse(undefined);
    setErreurConfirmation(undefined);

    setEnCours(true);
    setErreur(null);

    const { error } = await supabase.auth.updateUser({ password: verdict.motDePasse });
    if (error) {
      setErreur(error.message);
      setEnCours(false);
      return;
    }
    // Révocation des autres sessions ; la session courante reste valide.
    await supabase.auth.signOut({ scope: "others" });

    router.replace("/");
    router.refresh();
  }

  return (
    <form onSubmit={soumettre} className="space-y-3">
      {erreur && (
        <BandeauInfo ton="danger" taille="compacte">
          <p className="leading-relaxed text-danger">{erreur}</p>
        </BandeauInfo>
      )}

      <Champ
        id="nouveau-mot-de-passe"
        label="Nouveau mot de passe"
        type="password"
        requis
        minLength={8}
        autoComplete="new-password"
        value={motDePasse}
        onChange={(e) => setMotDePasse(e.target.value)}
        erreur={erreurMotDePasse}
        placeholder="8 caractères minimum"
      />

      <Champ
        id="confirmation-mot-de-passe"
        label="Confirmer le nouveau mot de passe"
        type="password"
        requis
        autoComplete="new-password"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        erreur={erreurConfirmation}
        placeholder="Le même mot de passe"
      />

      <Bouton type="submit" variante="principal" className="w-full" enChargement={enCours}>
        Enregistrer et se connecter
      </Bouton>

      <p className="text-[0.6875rem] leading-relaxed text-texte-discret">
        Les autres appareils restés connectés seront déconnectés.
      </p>
    </form>
  );
}
