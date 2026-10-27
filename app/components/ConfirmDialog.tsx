"use client";

export default function ConfirmDialog({
  title,
  description,
  confirmLabel = "Obriši",
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#17182f] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.6)]">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ff9d9d]">Potvrda</p>
        <h2 id="confirm-title" className="mt-2 font-serif text-xl font-semibold text-white">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-[#a9adcf]">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="btn">Otkaži</button>
          <button type="button" onClick={onConfirm} className="btn btn-danger">{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
