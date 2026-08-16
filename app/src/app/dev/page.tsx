import { redirect } from "next/navigation";

export default function DevPage() {
  redirect("/admin?onglet=workflow");
}
