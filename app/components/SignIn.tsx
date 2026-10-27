"use client";

import { useState } from "react";
import { ID, getAppwrite } from "../lib/appwrite";
import InstallApp from "./InstallApp";

function internalEmail(username: string) {
  return `${username.trim().toLowerCase()}@note-space.app`;
}

function authMessage(message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes("user with the requested id already exists")) {
    return "Ovo korisničko ime već postoji.";
  }
  if (normalized.includes("user with the requested id could not be found")) {
    return "Nalog ne postoji. Izaberi Novi nalog da ga napraviš.";
  }
  if (normalized.includes("password")) {
    return "Proveri korisničko ime i lozinku.";
  }
  return message;
}

export default function SignIn() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const normalizedUsername = username.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,30}$/.test(normalizedUsername)) {
      setMessage("Korisničko ime mora imati 3-30 slova, brojeva, _ ili -.");
      return;
    }
    if (mode === "signUp" && password !== confirmPassword) {
      setMessage("Lozinke se ne podudaraju.");
      return;
    }

    setMessage("");
    setBusy(true);
    const email = internalEmail(normalizedUsername);
    let error: Error | null = null;

    try {
      if (mode === "signIn") {
        await getAppwrite().account.createEmailPasswordSession({ email, password });
      } else {
        await getAppwrite().account.create({ userId: ID.unique(), email, password, name: normalizedUsername });
        await getAppwrite().account.createEmailPasswordSession({ email, password });
      }
    } catch (caught) {
      error = caught as Error;
    }

    if (error) {
      setMessage(authMessage(error.message));
      setBusy(false);
    } else {
      window.location.reload();
    }
  }

  return (
    <main className="aurora-canvas relative flex flex-1 items-center justify-center overflow-hidden p-5 md:p-8">
      <div className="relative grid w-full max-w-4xl overflow-hidden rounded-[1.75rem] md:grid-cols-[1.05fr_0.95fr]">
        <div className="glass-panel hidden flex-col justify-between border-r-0 p-10 md:flex">
          <div>
            <span className="inline-flex rounded-full border border-[#ffb454]/30 bg-[#ffb454]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffd9a8]">
              tvoj kreativni portal
            </span>
            <h2 className="mt-8 max-w-sm font-serif text-4xl leading-tight text-white">
              Jedno mesto za sve tvoje misli.
            </h2>
            <p className="mt-5 max-w-sm text-sm leading-7 text-[#a8adcf]">
              Piši, čuvaj ideje i gradi sopstveni sistem. Lični, porodični i kreativni prostor — sve na jednom mestu.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-[#8f95c0]">
            <span className="h-2 w-2 rounded-full bg-[#ffb454] shadow-[0_0_14px_#ffb454]" />
            Space Note
          </div>
        </div>

        <form onSubmit={submit} className="glass-panel space-y-5 p-6 md:p-10">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffb454]">dobrodošao/la</p>
            <h1 className="mt-2 font-serif text-3xl font-semibold text-white">Space Note</h1>
            <p className="mt-2 text-sm leading-6 text-[#a8adcf]">Prijavi se i nastavi tamo gde si stao/la.</p>
            <div className="mt-3"><InstallApp /></div>
          </div>

          <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-black/20 p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("signIn")}
              className={`rounded-lg px-3 py-2.5 transition-colors ${mode === "signIn" ? "bg-white/10 text-white" : "text-[#8f95c0]"}`}
            >
              Prijava
            </button>
            <button
              type="button"
              onClick={() => setMode("signUp")}
              className={`rounded-lg px-3 py-2.5 transition-colors ${mode === "signUp" ? "bg-white/10 text-white" : "text-[#8f95c0]"}`}
            >
              Novi nalog
            </button>
          </div>

          <input
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Korisničko ime"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-[#6e7396] focus:border-[#ffb454]/60 focus:ring-2 focus:ring-[#ffb454]/15"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Lozinka (najmanje 6 znakova)"
            className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-[#6e7396] focus:border-[#ffb454]/60 focus:ring-2 focus:ring-[#ffb454]/15"
          />
          {mode === "signUp" && (
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Ponovi lozinku"
              className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-[#6e7396] focus:border-[#ffb454]/60 focus:ring-2 focus:ring-[#ffb454]/15"
            />
          )}

          <button disabled={busy} className="btn btn-primary min-h-12 w-full text-sm">
            {busy ? "Sačekaj…" : mode === "signIn" ? "Prijavi se" : "Napravi nalog"}
          </button>

          {message && (
            <p className="rounded-xl border border-[#ff9e9e]/25 bg-[#3a1420]/70 px-4 py-3 text-sm leading-5 text-[#ffc4c4]">
              {message}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
