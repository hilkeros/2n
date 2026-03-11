import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ProximityDebugPanel } from "@/components/ProximityDebugPanel";

export default async function ProximityDebugPage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Proximity Diagnostics</h1>
          <Link
            href="/"
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            Back to app
          </Link>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Open this page in both browsers to compare active rows and pairwise distances.
        </p>

        <ProximityDebugPanel />
      </main>
    </div>
  );
}
