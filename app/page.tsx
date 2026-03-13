import { getSession } from "@/lib/auth/session";
import { LoginForm } from "@/components/LoginForm";
import { LogoutButton } from "@/components/LogoutButton";
import { ProximitySummary } from "@/components/ProximitySummary";
import { DynamicTitle } from "@/components/DynamicTitle";
import { resolveDidToHandle } from "@/lib/identity";

export default async function Home() {
  const session = await getSession();
  const handle = session ? await resolveDidToHandle(session.did) : null;

  return (
    <div className="min-h-screen">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-4">
        <header className="mb-4 grid grid-cols-[1fr_auto_1fr] items-start gap-4">
          <div className="min-w-0 self-center text-left">
            {session && (
              <>
                <p className="text-sm text-zinc-500">Logged in user</p>
                <p className="truncate font-mono text-sm text-zinc-200">{handle ?? session.did}</p>
              </>
            )}
          </div>

          <div className="text-center">
            <DynamicTitle enabled={Boolean(session)} />
            <p className="text-zinc-400">by hilke</p>
          </div>

          <div className="flex justify-end self-center">
            {session ? <LogoutButton /> : null}
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center">
          {session ? (
            <div className="w-full">
              <ProximitySummary currentUserLabel={handle ?? session.did} />
            </div>
          ) : (
            <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
              <LoginForm />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
