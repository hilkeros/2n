import { getSession } from "@/lib/auth/session";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { LogoutButton } from "@/components/LogoutButton";
import { ProximitySummary } from "@/components/ProximitySummary";
import { resolveDidToHandle } from "@/lib/identity";

export default async function Home() {
  const session = await getSession();
  const handle = session ? await resolveDidToHandle(session.did) : null;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            2ⁿ
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            by hilke
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          {session ? (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Logged in user</p>
                  <p className="font-mono text-sm text-zinc-900 dark:text-zinc-100">{handle ?? session.did}</p>
                  {handle && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{session.did}</p>
                  )}
                </div>
                <LogoutButton />
              </div>

              <ProximitySummary />

              <Link
                href="/debug"
                className="inline-flex rounded-md border border-zinc-300 px-3 py-1.5 text-xs text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Open full debug view
              </Link>
            </div>
          ) : (
            <LoginForm />
          )}
        </div>
      </main>
    </div>
  );
}
