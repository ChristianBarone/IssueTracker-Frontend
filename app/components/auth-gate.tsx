'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  HARD_CODED_USERS,
  getStoredUser,
  setStoredUser,
  fetchGeneratedApiKey
} from '../lib/auth';

function subscribeToAuthStorage(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {};

  window.addEventListener('storage', onStoreChange);
  return () => window.removeEventListener('storage', onStoreChange);
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const currentUser = useSyncExternalStore(subscribeToAuthStorage, getStoredUser, () => null);
  const [selectedUser, setSelectedUser] = useState(() => currentUser ?? HARD_CODED_USERS[0]);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;

    if (pathname === '/') {
      router.replace('/issues');
    }
  }, [currentUser, pathname, router]);

  const handleSignIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);

    try {
      const authUser = await fetchGeneratedApiKey(selectedUser);
      setStoredUser(authUser.username, authUser.apiKey);
      router.replace('/issues');
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : 'Failed to load user key');
    }
  };

  if (!currentUser) {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-10 text-slate-700" style={{ backgroundImage: 'radial-gradient(circle at top left, rgba(47, 147, 184, 0.18), transparent 28%), radial-gradient(circle at top right, rgba(93, 197, 181, 0.16), transparent 24%), linear-gradient(180deg, #f6f9fc 0%, #eef4f8 100%)' }}>
        <div className="grid w-full max-w-[980px] gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/80 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur">
            <div className="inline-flex rounded-full border border-[#2f93b8]/20 bg-[#2f93b8]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#2f93b8]">
              Issue Tracker Access
            </div>
            <h1 className="mt-5 text-[42px] font-black leading-[0.95] tracking-tight text-slate-900 md:text-[54px]">
              Choose a user and enter the tracker.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 md:text-lg">
              This login uses five default users and loads each user's generated backend API key when you sign in.
            </p>

            <div className="mt-8 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
              {[
                'Fast persona switching',
                'No password step',
                'Works from the first screen'
              ].map((item) => (
                <div key={item} className="rounded-[18px] border border-slate-200 bg-white px-4 py-4 font-medium shadow-[0_1px_0_rgba(15,23,42,0.03)]">
                  {item}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-200/80 bg-[#0f172a] p-6 text-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] md:p-8">
            <div className="mb-6">
              <h2 className="text-[28px] font-bold tracking-tight">Sign in</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">Select one of the predefined users to continue.</p>
            </div>

            <form onSubmit={handleSignIn} className="grid gap-5">
              {loginError && (
                <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {loginError}
                </div>
              )}

              <label className="grid gap-2 text-sm font-semibold text-slate-200">
                User
                <select
                  value={selectedUser}
                  onChange={(event) => setSelectedUser(event.target.value)}
                  className="h-12 rounded-[14px] border border-slate-700 bg-slate-900 px-4 text-base text-white outline-none transition-colors focus:border-[#5dc5b5]"
                >
                  {HARD_CODED_USERS.map((user) => (
                    <option key={user} value={user}>
                      {user}
                    </option>
                  ))}
                </select>
              </label>

              <div className="rounded-[18px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                The selected user will be stored in the browser and used throughout the app, including comment permissions.
              </div>

              <button
                type="submit"
                className="inline-flex h-12 items-center justify-center rounded-[14px] bg-gradient-to-b from-[#82e9de] to-[#59d8cc] px-5 font-bold text-slate-950 shadow-[0_6px_0_#40bbb1] transition-transform hover:-translate-y-px"
              >
                Continue to issues
              </button>
            </form>

            <div className="mt-7 border-t border-white/10 pt-5 text-xs uppercase tracking-[0.2em] text-slate-400">
              5 default users
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <>{children}</>
  );
}