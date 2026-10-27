"use client";

import { useEffect, useRef, useState } from "react";
import type { MediaKind } from "../lib/types";

interface RecorderProps {
  kind: MediaKind;
  onSave: (blob: Blob) => void;
  onClose: () => void;
}

type Status = "idle" | "recording" | "stopped" | "denied";

export default function Recorder({ kind, onSave, onClose }: RecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(
    null
  );

  useEffect(() => {
    let active = true;
    mountedRef.current = true;

    async function initStream() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(
          kind === "video" ? { audio: true, video: true } : { audio: true }
        );
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (kind === "video" && videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch {
        if (active) {
          setStatus("denied");
          setError(
            "Pristup mikrofonu/kameri nije odobren. Dozvolite pristup u browseru pa pokušajte ponovo."
          );
        }
      }
    }

    initStream();

    return () => {
      active = false;
      mountedRef.current = false;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [kind]);

  useEffect(() => {
    if (status !== "recording") return;
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  function start() {
    const stream = streamRef.current;
    if (!stream) return;

    chunksRef.current = [];
    const recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      if (!mountedRef.current) return;
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || (kind === "video" ? "video/webm" : "audio/webm"),
      });
      setPreview({ url: URL.createObjectURL(blob), blob });
      setStatus("stopped");
    };

    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setStatus("recording");
  }

  function stop() {
    recorderRef.current?.stop();
  }

  function reset() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    setSeconds(0);
    setStatus("idle");
  }

  function save() {
    if (preview) onSave(preview.blob);
    onClose();
  }

  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60
  ).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#040816]/75 p-4 backdrop-blur-sm">
      <div className="space-modal w-full max-w-lg rounded-xl border border-cyan-100/20 p-5 text-[#e9f5ff] shadow-[0_24px_70px_rgba(0,0,0,0.55)]">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold text-white">
            {kind === "video" ? "🎥 Snimanje videa" : "🎙️ Snimanje zvuka"}
          </h3>
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1 text-sm text-cyan-50/70 hover:bg-white/10 hover:text-white"
          >
            Zatvori
          </button>
        </div>

        {error ? (
          <p className="rounded-lg border border-[#ff9876]/30 bg-[#412634]/75 p-3 text-sm text-[#ffc3ad]">
            {error}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="overflow-hidden rounded-lg border border-cyan-100/10 bg-[#020615]/70">
              {kind === "video" ? (
                preview ? (
                  <video src={preview.url} controls className="w-full" />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full"
                  />
                )
              ) : (
                <div className="flex h-32 items-center justify-center">
                  {preview ? (
                    <audio src={preview.url} controls className="w-full px-4" />
                  ) : (
                    <div className="text-center">
                      <div
                        className={`text-4xl ${
                          status === "recording" ? "animate-pulse" : ""
                        }`}
                      >
                        🎙️
                      </div>
                      <div className="mt-2 font-mono text-2xl text-cyan-50">
                        {time}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="font-mono text-sm text-cyan-50/70">
                {status === "recording" ? (
                  <span className="flex items-center gap-2 text-[#ffb08f]">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff795e]" />
                    {time}
                  </span>
                ) : (
                  time
                )}
              </span>

              <div className="flex gap-2">
                {status === "idle" && (
                  <button
                    onClick={start}
                    className="rounded-md bg-[#ff795e] px-5 py-2 text-sm font-medium text-[#1c0b12] hover:bg-[#ffa17f]"
                  >
                    Snimaj
                  </button>
                )}
                {status === "recording" && (
                  <button
                    onClick={stop}
                    className="rounded-md bg-cyan-100 px-5 py-2 text-sm font-medium text-[#071125] hover:bg-white"
                  >
                    Zaustavi
                  </button>
                )}
                {status === "stopped" && (
                  <>
                    <button
                      onClick={reset}
                      className="rounded-md border border-cyan-100/25 px-5 py-2 text-sm font-medium text-cyan-50 hover:bg-white/10"
                    >
                      Ponovo
                    </button>
                    <button
                      onClick={save}
                      className="rounded-md bg-[#67d9d4] px-5 py-2 text-sm font-medium text-[#071125] hover:bg-[#9bece8]"
                    >
                      Sačuvaj
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
