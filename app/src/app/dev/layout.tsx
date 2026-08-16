import { notFound } from "next/navigation";
import { estAdministrateur } from "@/lib/store/acces";

export default async function DevLayout({ children }: { children: React.ReactNode }) {
  const admin = await estAdministrateur();
  if (!admin && process.env.NODE_ENV === "production") {
    notFound();
  }
  return <>{children}</>;
}
