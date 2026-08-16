"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { cleParCompte } from "@/lib/ui/stockage-session";

interface ContexteOnboardingType {
  compteId: string;
  tourActif: string | null;
  lancerTour: (tourId: string) => void;
  fermerTour: () => void;
  estTourTermine: (tourId: string) => boolean;
  terminerTour: (tourId: string) => void;
  reinitialiserTour: (tourId: string) => void;
}

const ContexteOnboarding = createContext<ContexteOnboardingType | null>(null);

export function cleTour(tourId: string, compteId: string): string {
  return cleParCompte(`tour:${tourId}`, compteId);
}

export function FournisseurOnboarding({
  compteId,
  children,
}: {
  compteId: string;
  children: ReactNode;
}) {
  const [tourActif, setTourActif] = useState<string | null>(null);
  const [estMonte, setEstMonte] = useState(false);

  useEffect(() => {
    setEstMonte(true);
  }, []);

  const estTourTermine = useCallback(
    (tourId: string): boolean => {
      if (!estMonte || typeof window === "undefined") return true;
      try {
        return window.localStorage.getItem(cleTour(tourId, compteId)) === "1";
      } catch {
        return false;
      }
    },
    [compteId, estMonte],
  );

  const terminerTour = useCallback(
    (tourId: string) => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(cleTour(tourId, compteId), "1");
        } catch {
          // Ignore les erreurs de quota ou mode privé
        }
      }
      setTourActif((actuel) => (actuel === tourId ? null : actuel));
    },
    [compteId],
  );

  const reinitialiserTour = useCallback(
    (tourId: string) => {
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(cleTour(tourId, compteId));
        } catch {
          // Ignore
        }
      }
      setTourActif(tourId);
    },
    [compteId],
  );

  const lancerTour = useCallback((tourId: string) => {
    setTourActif(tourId);
  }, []);

  const fermerTour = useCallback(() => {
    setTourActif(null);
  }, []);

  return (
    <ContexteOnboarding.Provider
      value={{
        compteId,
        tourActif,
        lancerTour,
        fermerTour,
        estTourTermine,
        terminerTour,
        reinitialiserTour,
      }}
    >
      {children}
    </ContexteOnboarding.Provider>
  );
}

export function useOnboarding() {
  const ctx = useContext(ContexteOnboarding);
  if (!ctx) {
    throw new Error("useOnboarding doit être utilisé à l'intérieur d'un FournisseurOnboarding");
  }
  return ctx;
}
