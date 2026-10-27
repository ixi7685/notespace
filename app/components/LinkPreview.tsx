"use client";

import { useEffect, useMemo, useState } from "react";

interface PreviewData {
  title: string;
  description: string;
  thumbnail?: string;
  provider: string;
  url: string;
  embedUrl?: string;
  embedHeight?: number;
}

function extractYouTubeId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/i,
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/i,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

function isYouTubeLink(url: string) {
  return /youtube\.com|youtu\.be/i.test(url);
}

function isPinterestLink(url: string) {
  return /pinterest\.com|pin\.it/i.test(url);
}

function isSubstackLink(url: string) {
  return /(?:^|\.)substack\.com/i.test(getDomain(url));
}

function extractPinterestId(url: string) {
  return url.match(/\/pin\/(\d+)/i)?.[1] ?? null;
}

function providerForUrl(url: string) {
  const providers: [RegExp, string][] = [
    [/youtube\.com|youtu\.be/i, "YouTube"],
    [/pinterest\.com|pin\.it/i, "Pinterest"],
    [/substack\.com/i, "Substack"],
    [/instagram\.com/i, "Instagram"],
    [/facebook\.com|fb\.watch/i, "Facebook"],
    [/tiktok\.com/i, "TikTok"],
    [/open\.spotify\.com/i, "Spotify"],
    [/soundcloud\.com/i, "SoundCloud"],
    [/vimeo\.com/i, "Vimeo"],
    [/reddit\.com|redd\.it/i, "Reddit"],
    [/x\.com|twitter\.com/i, "X"],
    [/linkedin\.com/i, "LinkedIn"],
    [/twitch\.tv/i, "Twitch"],
    [/medium\.com/i, "Medium"],
    [/github\.com/i, "GitHub"],
    [/behance\.net/i, "Behance"],
    [/dribbble\.com/i, "Dribbble"],
    [/notion\.site/i, "Notion"],
  ];
  return providers.find(([pattern]) => pattern.test(url))?.[1] ?? getDomain(url);
}

function mediaEmbed(url: string): string | undefined {
  const instagramId = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i)?.[1];
  if (instagramId) return `https://www.instagram.com/p/${instagramId}/embed/`;

  const spotify = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([^/?#]+)/i);
  if (spotify) return `https://open.spotify.com/embed/${spotify[1]}/${spotify[2]}`;

  const soundcloud = /soundcloud\.com/i.test(url);
  if (soundcloud) return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%236fe3dc`;

  const vimeoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
  if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;

  const tiktokId = url.match(/tiktok\.com\/.*?video\/(\d+)/i)?.[1];
  if (tiktokId) return `https://www.tiktok.com/player/v1/${tiktokId}`;

  const pinterestId = extractPinterestId(url);
  if (pinterestId) return `https://assets.pinterest.com/ext/embed.html?id=${pinterestId}`;

  return undefined;
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "link";
  }
}

async function fetchPreview(url: string): Promise<PreviewData | null> {
  const normalized = url.trim();

  try {
    if (isSubstackLink(normalized)) {
      return {
        title: "Substack članak",
        description: "Otvori Substack sadržaj u novom tabu.",
        provider: "Substack",
        url: normalized,
      };
    }

    if (isYouTubeLink(normalized)) {
      const id = extractYouTubeId(normalized);
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(normalized)}&format=json`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        return {
          title: "YouTube video",
          description: getDomain(normalized),
          thumbnail: id
            ? `https://img.youtube.com/vi/${id}/hqdefault.jpg`
            : undefined,
          provider: "YouTube",
          url: normalized,
          embedUrl: id ? `https://www.youtube.com/embed/${id}` : undefined,
        };
      }

      const data = (await response.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };

      return {
        title: data.title ?? "YouTube video",
        description: data.author_name ?? getDomain(normalized),
        thumbnail: data.thumbnail_url ??
          (id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : undefined),
        provider: "YouTube",
        url: normalized,
        embedUrl: id ? `https://www.youtube.com/embed/${id}` : undefined,
      };
    }

    if (isPinterestLink(normalized)) {
      const response = await fetch(
        `/api/pinterest-preview?url=${encodeURIComponent(normalized)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        return {
          title: "Pinterest pin",
          description: "Otvori originalni pin na Pinterest-u.",
          provider: "Pinterest",
          url: normalized,
          embedHeight: 280,
          embedUrl: extractPinterestId(normalized)
            ? `https://assets.pinterest.com/ext/embed.html?id=${extractPinterestId(normalized)}`
            : undefined,
        };
      }

      const data = (await response.json()) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
        provider_name?: string;
      };

      return {
        title: data.title ?? "Pinterest pin",
        description: data.author_name ?? data.provider_name ?? getDomain(normalized),
        thumbnail: data.thumbnail_url,
        provider: "Pinterest",
        url: normalized,
        embedHeight: 280,
        embedUrl: data.thumbnail_url ? undefined : mediaEmbed(normalized),
      };
    }

    const response = await fetch(
      `/api/link-preview?url=${encodeURIComponent(normalized)}`,
      { cache: "no-store" }
    );
    if (response.ok) {
      const data = (await response.json()) as {
        title?: string;
        description?: string;
        thumbnail_url?: string;
      };
      return {
        title: data.title ?? providerForUrl(normalized),
        description: data.description ?? "Otvori originalni sadržaj.",
        thumbnail: data.thumbnail_url ?? undefined,
        provider: providerForUrl(normalized),
        url: normalized,
        embedUrl: mediaEmbed(normalized),
        embedHeight: 280,
      };
    }
  } catch {
    if (isPinterestLink(normalized)) {
      return {
        title: "Pinterest pin",
        description: "Otvori originalni pin na Pinterest-u.",
        provider: "Pinterest",
        url: normalized,
        embedHeight: 280,
        embedUrl: mediaEmbed(normalized),
      };
    }
  }

  return {
    title: providerForUrl(normalized),
    description: "Otvori originalni sadržaj.",
    provider: providerForUrl(normalized),
    url: normalized,
    embedUrl: mediaEmbed(normalized),
    embedHeight: 280,
  };
}

export default function LinkPreview({ url, compact = false, onSelect }: { url: string; compact?: boolean; onSelect?: () => void }) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      const preview = await fetchPreview(url);
      if (alive) {
        setData(preview);
        setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [url]);

  const title = useMemo(() => data?.title ?? "Link preview", [data]);

  if (!data && !loading) return null;

  if (loading) {
    return (
      <div className={`rounded-xl border border-cyan-100/15 bg-[#071125]/75 p-3 text-xs text-cyan-50/60 ${compact ? "min-h-16" : "min-h-24"}`}>
        Učitavanje pregleda linka…
      </div>
    );
  }

  if (compact) {
    return (
      <button type="button" onClick={onSelect} className="group flex min-h-16 w-full items-center gap-3 rounded-xl border border-white/10 bg-[#11142b] p-2.5 text-left transition-colors hover:border-[#ffb454]/45 hover:bg-[#1a1b36]">
        {data?.thumbnail ? <img src={data.thumbnail} alt="" width={88} height={56} loading="lazy" className="h-14 w-20 shrink-0 rounded-lg object-cover" /> : <span className="grid h-14 w-20 shrink-0 place-items-center rounded-lg bg-[#ffb454]/10 text-lg text-[#ffd9a8]">↗</span>}
        <span className="min-w-0 flex-1"><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8b90b8]">{data?.provider}</span><span className="mt-1 block truncate text-sm font-semibold text-white group-hover:text-[#ffd9a8]">{title}</span><span className="mt-0.5 block truncate text-xs text-[#8b90b8]">Klikni za uvećani pregled</span></span>
        <span className="shrink-0 text-lg text-[#8b90b8] group-hover:text-[#ffb454]">↗</span>
      </button>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#ffb454]/30 bg-[#071125]/75 text-cyan-50 shadow-[0_12px_30px_rgba(0,0,0,0.2)]">
      {data?.embedUrl ? (
        <div className="h-[280px] w-full bg-black">
          <iframe
            src={data.embedUrl}
            title={title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : data?.thumbnail ? (
        <a href={data.url} target="_blank" rel="noreferrer" className="block">
          <img src={data.thumbnail} alt={title} className="h-[280px] w-full object-cover" />
        </a>
      ) : (
        <a
          href={data?.url}
          target="_blank"
          rel="noreferrer"
          className="flex h-[280px] w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_50%_35%,rgba(112,228,220,0.2),transparent_34%),linear-gradient(145deg,#111c42,#271a4a)] text-center"
        >
          <span className="grid h-16 w-16 place-items-center rounded-2xl border border-cyan-100/25 bg-cyan-100/10 text-2xl text-[#95e9e0]">✦</span>
          <span className="text-sm font-medium text-white">{data?.provider}</span>
          <span className="text-xs text-cyan-50/60">Otvori originalni sadržaj</span>
        </a>
      )}

      <div className="flex min-h-[92px] flex-col justify-center space-y-1 p-3">
        <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-[0.12em] text-cyan-100/50">
          <span>{data?.provider}</span>
          <div className="flex items-center gap-3"><button type="button" onClick={onSelect} className="text-[#ffd9a8] hover:text-white">Smanji</button><a href={data?.url} target="_blank" rel="noreferrer" className="text-[#6fe3dc] hover:text-[#b6fff8]">Otvori</a></div>
        </div>
        <a href={data?.url} target="_blank" rel="noreferrer" className="block text-sm font-semibold text-white hover:text-[#b6fff8]">
          {title}
        </a>
        <p className="text-xs text-cyan-50/60">{data?.description}</p>
      </div>
    </div>
  );
}
