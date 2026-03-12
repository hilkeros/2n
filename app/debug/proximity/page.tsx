import { redirect } from "next/navigation";

export default async function LegacyProximityDebugPage() {
  redirect("/debug");
}
