"use client";

import { useMemo, useRef, useState } from "react";
import { Document, Packer, Paragraph, TextRun } from "docx";
import LinkPreview from "./LinkPreview";
import ConfirmDialog from "./ConfirmDialog";
import RichTextEditor from "./RichTextEditor";
import type { Goal, Media } from "../lib/types";

export type NoteViewMode = "grid" | "list" | "icons";

function MediaItem({ media, onDelete }: { media: Media; onDelete: () => void }) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-white/10 bg-black/30">
      {media.kind === "image" ? (
        <a href={media.url} target="_blank" rel="noreferrer" className="block">
          <img
            src={media.url}
            alt="Slika u belešci"
            className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </a>
      ) : media.kind === "video" ? (
        <video src={media.url} controls className="w-full" />
      ) : (
        <audio src={media.url} controls className="w-full p-2" />
      )}
      <div className="flex items-center justify-between px-2 py-1 text-[11px] text-[#9096b8]">
        <span>
          {media.kind === "image" ? "🖼️ Slika" : media.kind === "video" ? "🎥 Video" : "🎙️ Audio"} ·{" "}
          {new Date(media.createdAt).toLocaleString("sr-RS")}
        </span>
        <div className="flex gap-2">
          <a href={media.url} download={`${media.kind}-${media.id}.webm`} className="hover:text-white">
            Preuzmi
          </a>
          <button onClick={onDelete} className="hover:text-[#ff9d9d]">
            Obriši
          </button>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;")
    .replaceAll("\n", "<br>");
}

function editorHtml(value: string) {
  return /<(p|br|strong|b|em|i|u|s|h2|h3|ul|ol|li|blockquote|a)\b/i.test(value)
    ? value
    : escapeHtml(value);
}

function plainText(value: string) {
  const parsed = new DOMParser().parseFromString(editorHtml(value), "text/html");
  return parsed.body.textContent ?? "";
}

function extractUrls(value: string) {
  const parsed = new DOMParser().parseFromString(editorHtml(value), "text/html");
  parsed.querySelectorAll("br").forEach((element) => element.replaceWith("\n"));
  parsed.querySelectorAll("p,div,li,h1,h2,h3,blockquote,pre").forEach((element) => element.append("\n"));
  const source = parsed.body.textContent ?? value;
  const tokens = source.split(/\s+/).flatMap((token) => token.split(/(?=https?:\/\/)/i)).filter(Boolean);
  const textUrls: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    if (!/^https?:\/\//i.test(tokens[index])) continue;
    let url = tokens[index];
    while (/[?&]$/.test(url) && index + 1 < tokens.length && /^[\w%.-]+=[^\s]*$/.test(tokens[index + 1]) && !/^https?:\/\//i.test(tokens[index + 1])) {
      url += tokens[index + 1];
      index += 1;
    }
    textUrls.push(url);
  }

  const anchors = Array.from(parsed.querySelectorAll("a[href]"), (anchor) => anchor.getAttribute("href") ?? "");
  const normalize = (url: string) => url.replace(/&(?:amp|#38);/gi, "&").replace(/[),.;]+$/g, "").trim();
  return [...new Set([...anchors, ...textUrls].map(normalize).filter((url) => /^https?:\/\//i.test(url)))];
}

export { RichTextEditor };

interface NoteCardProps {
  title: string;
  text: string;
  goalId: string | null;
  goals: Goal[];
  media: Media[];
  updatedAt: number;
  onChange: (patch: { title?: string; text?: string }) => void;
  onGoalChange: (goalId: string | null) => void;
  onDelete: () => void;
  onDeleteMedia: (mediaId: string) => void;
  onAddFiles: (files: File[]) => void;
  onRecordAudio: () => void;
  onRecordVideo: () => void;
  viewMode: NoteViewMode;
  onReorder: (fromId: string, toId: string) => void;
  noteId: string;
}

export default function NoteCard({
  title,
  text,
  goalId,
  goals,
  media,
  updatedAt,
  onChange,
  onGoalChange,
  onDelete,
  onDeleteMedia,
  onAddFiles,
  onRecordAudio,
  onRecordVideo,
  viewMode,
  onReorder,
  noteId,
}: NoteCardProps) {
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState(false);
  const [imported, setImported] = useState(false);
  const [documentError, setDocumentError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMedia, setShowMedia] = useState(false);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(plainText(text));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard nedostupan */
    }
  }

  async function paste() {
    try {
      const clip = await navigator.clipboard.readText();
      onChange({ text: text ? `${plainText(text)}\n${clip}` : clip });
      setPasted(true);
      setTimeout(() => setPasted(false), 1500);
    } catch {
      /* clipboard nedostupan */
    }
  }

  async function pasteImage() {
    try {
      const items = await navigator.clipboard.read();
      const files: File[] = [];
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        files.push(new File([blob], `nalepljena-slika-${Date.now()}.${imageType.split("/")[1]}`, { type: imageType }));
      }
      if (files.length) onAddFiles(files);
    } catch {
      /* clipboard nedostupan ili ne sadrži sliku */
    }
  }

  async function importText(file: File) {
    const value = await file.text();
    if (!value.trim()) return;
    onChange({ text: text ? `${plainText(text)}\n\n${value}` : value });
    setImported(true);
    setTimeout(() => setImported(false), 1500);
  }

  async function importDocument(file: File) {
    try {
      let value = "";
      if (file.name.toLowerCase().endsWith(".docx")) {
        const mammoth = await import("mammoth");
        value = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
      } else if (file.name.toLowerCase().endsWith(".pdf")) {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          const content = await page.getTextContent();
          pages.push(content.items.map((item) => ("str" in item ? item.str : "")).join(" "));
        }
        value = pages.join("\n\n");
      } else {
        value = await file.text();
      }

      if (!value.trim()) throw new Error("empty");
      onChange({ text: text ? `${plainText(text)}\n\n${value.trim()}` : value.trim() });
      setImported(true);
      setDocumentError("");
      setTimeout(() => setImported(false), 1500);
    } catch {
      setDocumentError("Ne mogu da pročitam ovaj dokument.");
    }
  }

  async function exportWord() {
    const docxDocument = new Document({
      sections: [
        {
          children: [
            new Paragraph({ children: [new TextRun({ text: title || "Space Note beleška", bold: true, size: 30 })] }),
            ...plainText(text).split("\n").map((line) => new Paragraph(line)),
          ],
        },
      ],
    });
    const blob = await Packer.toBlob(docxDocument);
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title || "space-note-beleska"}.docx`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const popup = window.open("", "_blank", "noopener,noreferrer,width=800,height=900");
    if (!popup) return;
    popup.document.write(
      `<html><head><title>${title || "Space Note beleška"}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:48px auto;line-height:1.7;color:#172033}h1{border-bottom:1px solid #ccd5e3;padding-bottom:16px}</style></head><body><h1>${title || "Space Note beleška"}</h1>${editorHtml(text)}</body></html>`
    );
    popup.document.close();
    popup.focus();
    popup.print();
  }

  function downloadFile(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportText() {
    const name = title || "Space Note beleška";
    downloadFile(`${title || "space-note-beleska"}.txt`, `${name}\n\n${plainText(text)}`, "text/plain");
  }

  function exportMarkdown() {
    downloadFile(`${title || "space-note-beleska"}.md`, `# ${title || "Space Note beleška"}\n\n${plainText(text)}`, "text/markdown");
  }

  const allUrls = useMemo(() => extractUrls(text), [text]);
  const previewUrls = allUrls.filter((value) => /youtube\.com|youtu\.be|pinterest\.com|pin\.it|instagram\.com|facebook\.com|fb\.watch|tiktok\.com|spotify\.com|soundcloud\.com|vimeo\.com|reddit\.com|redd\.it|x\.com|twitter\.com|linkedin\.com|twitch\.tv|substack\.com|medium\.com|github\.com|behance\.net|dribbble\.com|notion\.site/i.test(value));

  const unsupportedUrls = allUrls.filter((url) => !previewUrls.includes(url));

  const images = media.filter((item) => item.kind === "image");
  const recordings = media.filter((item) => item.kind !== "image");
  const activePreviewUrl = selectedPreviewUrl && previewUrls.includes(selectedPreviewUrl) ? selectedPreviewUrl : null;
  const summary = plainText(text).trim();
  const cleanSummary = summary.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
  const noteTitle = title.trim() || "Beleška bez naslova";
  const previewHosts = [...new Set(allUrls.map((url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "link"; } }))];
  const deleteDialog = confirmDelete && (
    <ConfirmDialog
      title={`Obrisati belešku „${noteTitle}“?`}
      description="Beleška, njeni linkovi i prilozi biće trajno obrisani. Ova radnja ne može da se vrati."
      confirmLabel="Obriši belešku"
      onCancel={() => setConfirmDelete(false)}
      onConfirm={() => { setConfirmDelete(false); setExpanded(false); onDelete(); }}
    />
  );

  const card = (
    <article
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/space-note", noteId)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const fromId = event.dataTransfer.getData("text/space-note");
        if (fromId) onReorder(fromId, noteId);
      }}
      className={`note-surface group relative flex overflow-hidden rounded-2xl border shadow-[0_14px_40px_rgba(0,0,0,0.35)] transition-[transform,border-color,box-shadow] hover:-translate-y-0.5 hover:border-[#ffb454]/45 hover:shadow-[0_20px_52px_rgba(0,0,0,0.45)] ${
        viewMode === "list" ? "min-h-28 items-stretch" : viewMode === "icons" ? "min-h-48 flex-col" : "min-h-[250px] flex-col"
      }`}
    >
      <button type="button" onClick={() => setExpanded(true)} className="note-card-content flex min-w-0 flex-1 flex-col text-left" aria-label={`Otvori belešku ${noteTitle}`}>
        <span className="flex min-w-0 flex-1 flex-col p-5">
          <span className="flex flex-wrap items-center justify-between gap-2 pr-10 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#ffb454]"><span>Beleška</span><span className="text-[#6e7396]">{new Date(updatedAt).toLocaleDateString("sr-RS")}</span></span>
          <span className={`mt-3 font-serif font-semibold leading-tight text-white ${viewMode === "icons" ? "line-clamp-2 text-base" : "line-clamp-2 text-xl"}`}>{noteTitle}</span>
          {cleanSummary ? <span className={`mt-2 text-sm leading-6 text-[#a9adcf] ${viewMode === "list" ? "line-clamp-1" : viewMode === "icons" ? "line-clamp-2 text-xs leading-5" : "line-clamp-3"}`}>{cleanSummary}</span> : allUrls.length === 0 && media.length === 0 ? <span className="mt-2 text-sm text-[#6e7396]">Prazna beleška. Klikni da počneš da pišeš.</span> : null}
          {allUrls.length > 0 && viewMode === "grid" && <span className="mt-3 flex flex-col gap-1.5">{previewHosts.slice(0, 2).map((host) => <span key={host} className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5 text-xs text-[#dfe1fb]"><span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-[#ffb454]/15 text-[10px] text-[#ffd9a8]">↗</span><span className="truncate">{host}</span></span>)}</span>}
          <span className="mt-auto flex flex-wrap gap-1.5 pt-4 text-[10px] text-[#8b90b8]">{allUrls.length > 0 && <span className="rounded-full border border-white/10 px-2 py-0.5">↗ {allUrls.length} {allUrls.length === 1 ? "link" : "linkova"}</span>}{media.length > 0 && <span className="rounded-full border border-white/10 px-2 py-0.5">📎 {media.length}</span>}{goalId && <span className="rounded-full border border-[#ffb454]/25 bg-[#ffb454]/10 px-2 py-0.5 text-[#ffd9a8]">🎯 Cilj</span>}</span>
        </span>
      </button>
      <button type="button" onClick={() => setConfirmDelete(true)} className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-black/40 text-xl leading-none text-[#a9adcf] transition-colors hover:border-[#ff9d9d]/40 hover:bg-[#ff9d9d]/10 hover:text-[#ff9d9d] focus-visible:text-[#ff9d9d]" aria-label={`Obriši belešku ${noteTitle}`} title="Obriši belešku">×</button>
    </article>
  );

  if (!expanded) return <>{card}{deleteDialog}</>;

  return (
    <>
      {card}
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" aria-hidden="true" />
      <article role="dialog" aria-modal="true" aria-label={`Beleška ${noteTitle}`} className="fixed inset-x-2 top-2 bottom-2 z-50 mx-auto flex max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#14152b] text-[#f2f1ff] shadow-[0_30px_90px_rgba(0,0,0,0.6)] md:inset-x-8 md:top-5 md:bottom-5">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#181934] px-5 py-3 md:px-8">
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#ffb454]">Beleška</span>
            <input
              value={title}
              onChange={(event) => onChange({ title: event.target.value })}
              placeholder="Naslov beleške…"
              aria-label="Naslov beleške"
              className="mt-0.5 block w-full bg-transparent font-serif text-xl font-semibold leading-tight text-white placeholder:text-[#6e7396] focus:outline-none md:text-2xl"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-danger min-h-9 px-3 text-xs" aria-label={`Obriši belešku ${noteTitle}`}>Obriši</button>
            <button type="button" onClick={() => setExpanded(false)} aria-label="Zatvori belešku" title="Zatvori" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-base leading-none text-[#c3c6e8] hover:border-[#ffb454]/45 hover:bg-[#ffb454]/10 hover:text-white">×</button>
          </div>
        </header>

        <div className="notes-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 md:px-8 md:py-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#8b90b8]"><span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1">Sačuvano {new Date(updatedAt).toLocaleString("sr-RS")}</span><span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1">{summary ? `${summary.length} karaktera` : "Prazna beleška"}</span>{allUrls.length > 0 && <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1">{allUrls.length} {allUrls.length === 1 ? "link" : "linkova"}</span>}{media.length > 0 && <span className="rounded-full border border-white/10 bg-black/15 px-2.5 py-1">{media.length} {media.length === 1 ? "prilog" : "priloga"}</span>}
          {goals.length > 0 && <label className="ml-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/15 px-2.5 py-1"><span className="text-[10px] font-semibold uppercase tracking-[0.12em]">Cilj</span><select value={goalId ?? ""} onChange={(event) => onGoalChange(event.target.value || null)} className="bg-transparent text-xs text-[#dfe1fb] outline-none" aria-label="Poveži belešku sa ciljem"><option value="">Bez cilja</option>{goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title}</option>)}</select></label>}
        </div>

        <RichTextEditor value={text} onChange={(nextText) => onChange({ text: nextText })} expanded />

        {allUrls.length > 0 && (
          <section className="shrink-0 rounded-2xl border border-white/10 bg-black/15 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#8b90b8]">Linkovi · {allUrls.length}</p><span className="text-[10px] text-[#6e7396]">Klikni na link za uvećani pregled</span></div>
            <div className="mt-3 space-y-3">
            {activePreviewUrl && <LinkPreview url={activePreviewUrl} onSelect={() => setSelectedPreviewUrl(null)} />}
            <div className="grid gap-2 sm:grid-cols-2">
              {previewUrls.filter((url) => url !== activePreviewUrl).map((url) => (
                <LinkPreview key={url} url={url} compact onSelect={() => setSelectedPreviewUrl(url)} />
              ))}
            </div>
            {unsupportedUrls.length > 0 && <div className="rounded-xl border border-white/10 bg-black/15 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b90b8]">Prepoznati linkovi bez preview-a</p><div className="mt-2 space-y-1">{unsupportedUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="block truncate text-xs text-[#8fc8ff] hover:text-white">{url}</a>)}</div><p className="mt-2 text-[11px] text-[#6e7396]">Link je sačuvan i može da se otvori, ali servis ne vraća javni preview.</p></div>}
            </div>
          </section>
        )}

        {media.length > 0 && (
          <section className="shrink-0 rounded-2xl border border-white/10 bg-black/15 p-2">
            <button type="button" onClick={() => setShowMedia((visible) => !visible)} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-left text-xs font-semibold text-[#dfe1fb] hover:border-[#ffb454]/35 hover:bg-white/5">
              <span>Prilozi: {media.length} {media.length === 1 ? "fajl" : "fajla"}</span><span className="text-[#ffd9a8]">{showMedia ? "Sakrij" : "Prikaži"}</span>
            </button>
            {showMedia && <div className="mt-3 space-y-3">{images.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{images.map((item) => <MediaItem key={item.id} media={item} onDelete={() => onDeleteMedia(item.id)} />)}</div>}{recordings.length > 0 && <div className="space-y-2">{recordings.map((item) => <MediaItem key={item.id} media={item} onDelete={() => onDeleteMedia(item.id)} />)}</div>}</div>}
          </section>
        )}

        <div className="note-toolbar flex shrink-0 flex-nowrap items-center gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-black/15 p-3 text-xs md:flex-wrap md:overflow-visible">
            <input
              ref={textInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importText(file);
                event.target.value = "";
              }}
            />
            <input
              ref={documentInputRef}
              type="file"
              accept=".txt,.md,.docx,.pdf,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importDocument(file);
                event.target.value = "";
              }}
            />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*,video/*,audio/*"
              multiple
              className="hidden"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                if (files.length) onAddFiles(files);
                event.target.value = "";
              }}
            />
            <button onClick={paste}>{pasted ? "Nalepljeno ✓" : "📋 Nalepi"}</button>
            <button onClick={copy}>{copied ? "Kopirano ✓" : "⧉ Kopiraj"}</button>
            <button onClick={() => textInputRef.current?.click()}>{imported ? "Uvezeno ✓" : "⇧ Uvezi tekst"}</button>
            <button onClick={() => documentInputRef.current?.click()}>
              {imported ? "Uvezeno ✓" : "⇧ Word/PDF"}
            </button>
            <button onClick={() => void exportWord()}>↓ Word</button>
            <button onClick={exportPdf}>⎙ PDF</button>
            <button onClick={exportText}>↓ TXT</button>
            <button onClick={exportMarkdown}>↓ Markdown</button>
            <button onClick={() => imageInputRef.current?.click()}>📎 Dodaj fajl</button>
            <button onClick={() => void pasteImage()}>📋 Nalepi sliku</button>
            <button onClick={onRecordAudio}>🎙️ Snimi audio</button>
            <button onClick={onRecordVideo}>🎥 Snimi video</button>

            <span className="ml-auto shrink-0 text-[#6e7396]">Sačuvano {new Date(updatedAt).toLocaleString("sr-RS")}</span>
        </div>

        {documentError && <p className="text-xs text-[#ff9d9d]">{documentError}</p>}
        </div>
      </article>
      {deleteDialog}
    </>
  );
}
