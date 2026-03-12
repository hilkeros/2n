import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ProximityExperience } from "@/components/ProximityExperience";
import { ProximityDebugPanel } from "@/components/ProximityDebugPanel";

export default async function DebugPage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">2ⁿ Debug</h1>
          <Link
            href="/"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Back to home
          </Link>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Full diagnostics view with raw proximity status, API checks, and pairwise distance telemetry.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          <ProximityExperience />
          <ProximityDebugPanel />
        </div>
      </main>
    </div>
  );
}
