"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function installationMode() {
  if (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone) return "installed";
  if (!window.isSecureContext) return "unsupported";
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "ios" : "browser";
}

function subscribeToInstallation(onChange: () => void) {
  const displayMode = window.matchMedia("(display-mode: standalone)");
  displayMode.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    displayMode.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

export default function InstallApp() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState("");
  const instructions = useRef<HTMLDialogElement>(null);
  const mode = useSyncExternalStore(subscribeToInstallation, installationMode, () => "unsupported");

  useEffect(() => {
    function offerInstallation(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
      setError("");
    }
    function finishInstallation() {
      setInstalled(true);
      setInstallPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", offerInstallation);
    window.addEventListener("appinstalled", finishInstallation);
    return () => {
      window.removeEventListener("beforeinstallprompt", offerInstallation);
      window.removeEventListener("appinstalled", finishInstallation);
    };
  }, []);

  async function install() {
    if (mode === "ios") {
      instructions.current?.showModal();
      return;
    }
    if (!installPrompt || installing) return;
    setInstalling(true);
    setError("");
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setError("Instalacija nije pokrenuta. Pokušaj preko menija pregledača.");
    } finally {
      setInstallPrompt(null);
      setInstalling(false);
    }
  }

  if (installed || mode === "installed" || mode === "unsupported" || (mode !== "ios" && !installPrompt && !error)) return null;

  return (
    <>
      {(mode === "ios" || installPrompt) && <button type="button" className="btn" onClick={() => void install()} disabled={installing} title="Instaliraj Space Note" aria-label="Instaliraj Space Note">
        {installing ? "Instaliranje…" : "Instaliraj"}
      </button>}
      {error && <span role="status" className="max-w-64 text-xs text-[#ffb9b9]">{error}</span>}
      <dialog ref={instructions} aria-labelledby="install-title" className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-sm rounded-lg border border-white/10 bg-[#17182f] p-6 text-[#f2f1ff] shadow-xl backdrop:bg-black/70">
        <h2 id="install-title" className="text-lg font-semibold">Instaliraj Space Note</h2>
        <p className="mt-3 text-sm leading-6 text-[#a9adcf]">U Safari pregledaču otvori meni „Podeli“ (Share), izaberi „Dodaj na početni ekran“ (Add to Home Screen), pa „Dodaj“ (Add).</p>
        <div className="mt-5 flex justify-end"><button type="button" className="btn" onClick={() => instructions.current?.close()} autoFocus>U redu</button></div>
      </dialog>
    </>
  );
}