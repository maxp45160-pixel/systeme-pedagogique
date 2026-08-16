import { redirect, notFound } from "next/navigation";
import { estAdministrateur } from "@/lib/store/acces";

export const dynamic = "force-dynamic";

export default async function PageWorkflow() {
  const admin = await estAdministrateur();
  if (!admin && process.env.NODE_ENV === "production") {
    notFound();
  }
  redirect("/admin?onglet=workflow");
}
