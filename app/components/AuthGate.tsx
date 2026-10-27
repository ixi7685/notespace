"use client";

import { useEffect, useState } from "react";
import { getAppwrite, isAppwriteConfigured } from "../lib/appwrite";
import NoteSpace from "./NoteSpace";
import SignIn from "./SignIn";

export default function AuthGate() {
  const [session, setSession] = useState<boolean>(false);
  const [checking, setChecking] = useState(isAppwriteConfigured);

  useEffect(() => {
    if (!isAppwriteConfigured()) return;
    getAppwrite().account.get().then(() => setSession(true)).catch(() => setSession(false)).finally(() => setChecking(false));
  }, []);

  if (!isAppwriteConfigured()) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-amber-400/20 bg-zinc-900 p-6 text-sm text-zinc-300">
          <h1 className="text-xl font-semibold text-zinc-100">Poveži Appwrite</h1>
          <p className="mt-3 leading-6">Dodaj Appwrite endpoint, project ID, database ID, collection ID-jeve i bucket ID u <code>.env.local</code>.</p>
        </div>
      </main>
    );
  }

  if (checking) {
    return <main className="flex flex-1 items-center justify-center text-zinc-500">Provera prijave...</main>;
  }

  return session ? <NoteSpace /> : <SignIn />;
}
