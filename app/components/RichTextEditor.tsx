"use client";

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";

type EditorSize = "normal" | "large" | "full";

function looksLikeHtml(value: string) {
  return /<[a-z][\s\S]*>/i.test(value);
}

function textToHtml(value: string) {
  if (!value.trim()) return "";
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${paragraph.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function Tool({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`editor-tool ${active ? "is-active" : ""}`}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, expanded }: { value: string; onChange: (value: string) => void; expanded: boolean }) {
  const [size, setSize] = useState<EditorSize>(expanded ? "large" : "normal");
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true, linkOnPaste: true, HTMLAttributes: { rel: "noreferrer", target: "_blank" } }),
      Placeholder.configure({ placeholder: "Počni da pišeš… nalepi tekst ili linkove, sve se automatski čuva." }),
    ],
    content: looksLikeHtml(value) ? value : textToHtml(value),
    editorProps: { attributes: { class: "rich-editor tiptap-content outline-none", spellcheck: "true" } },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? "" : current.getHTML()),
  });

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const nextHtml = looksLikeHtml(value) ? value : textToHtml(value);
    if (editor.getHTML() !== nextHtml && !(editor.isEmpty && !nextHtml)) editor.commands.setContent(nextHtml, { emitUpdate: false });
  }, [editor, value]);

  function addLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Unesi adresu linka", previous ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    if (!/^https?:\/\//i.test(url)) return;
    if (editor.state.selection.empty) {
      editor.chain().focus().insertContent(`<a href="${url.trim()}">${url.trim()}</a> `).run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  const words = editor?.getText().trim() ? editor.getText().trim().split(/\s+/).length : 0;
  const height = size === "full" ? "calc(100dvh - 300px)" : size === "large" ? "560px" : "340px";

  return (
    <div className="editor-frame flex shrink-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#101124] focus-within:border-[#ffb454]/50 focus-within:ring-2 focus-within:ring-[#ffb454]/10">
      <div className="editor-toolbar flex flex-wrap items-center gap-1 border-b border-white/10 bg-[#17182f] px-3 py-2" role="toolbar" aria-label="Alati za formatiranje teksta">
        <select
          value={editor?.isActive("heading", { level: 2 }) ? "h2" : editor?.isActive("heading", { level: 3 }) ? "h3" : "p"}
          onChange={(event) => {
            if (!editor) return;
            if (event.target.value === "p") editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: event.target.value === "h2" ? 2 : 3 }).run();
          }}
          aria-label="Stil teksta"
          className="editor-select"
        >
          <option value="p">Tekst</option>
          <option value="h2">Naslov</option>
          <option value="h3">Podnaslov</option>
        </select>
        <span className="editor-divider" />
        <Tool label="Podebljano" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()}><strong>B</strong></Tool>
        <Tool label="Kurziv" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()}><em>I</em></Tool>
        <Tool label="Podvučeno" active={editor?.isActive("underline")} onClick={() => editor?.chain().focus().toggleUnderline().run()}><u>U</u></Tool>
        <Tool label="Precrtano" active={editor?.isActive("strike")} onClick={() => editor?.chain().focus().toggleStrike().run()}><s>S</s></Tool>
        <span className="editor-divider" />
        <Tool label="Lista" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()}>•</Tool>
        <Tool label="Numerisana lista" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()}><span className="text-xs font-semibold">1.</span></Tool>
        <Tool label="Citat" active={editor?.isActive("blockquote")} onClick={() => editor?.chain().focus().toggleBlockquote().run()}><span className="text-lg leading-none">“</span></Tool>
        <Tool label="Kod" active={editor?.isActive("codeBlock")} onClick={() => editor?.chain().focus().toggleCodeBlock().run()}><span className="text-xs font-semibold">{"</>"}</span></Tool>
        <span className="editor-divider" />
        <Tool label="Link" active={editor?.isActive("link")} onClick={addLink}>↗</Tool>
        <Tool label="Poništi" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()}>↶</Tool>
        <Tool label="Ponovi" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()}>↷</Tool>
        <Tool label="Ukloni formatiranje" onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}>Tx</Tool>
        <span className="ml-auto flex items-center gap-2 text-[11px] text-[#6e7396]">
          <span className="hidden sm:inline">{words} {words === 1 ? "reč" : "reči"}</span>
          <span className="flex overflow-hidden rounded-lg border border-white/10" role="group" aria-label="Veličina editora">
            {(["normal", "large", "full"] as const).map((option) => (
              <button key={option} type="button" onClick={() => setSize(option)} className={`px-2.5 py-1 text-[11px] ${size === option ? "bg-[#ffb454]/20 text-white" : "text-[#a9adcf] hover:bg-white/5 hover:text-white"}`}>
                {option === "normal" ? "S" : option === "large" ? "M" : "L"}
              </button>
            ))}
          </span>
        </span>
      </div>
      <div className="editor-surface notes-scrollbar overflow-y-auto bg-[#121329]" style={{ height, minHeight: "280px", flexShrink: 0 }} onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} className="min-h-full px-5 py-6 md:px-8 md:py-7" />
      </div>
    </div>
  );
}
