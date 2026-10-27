const ALLOWED_HOSTS = [
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "fb.watch",
  "tiktok.com",
  "www.tiktok.com",
  "soundcloud.com",
  "www.soundcloud.com",
  "reddit.com",
  "www.reddit.com",
  "redd.it",
  "x.com",
  "www.x.com",
  "twitter.com",
  "www.twitter.com",
  "linkedin.com",
  "www.linkedin.com",
  "twitch.tv",
  "www.twitch.tv",
  "open.spotify.com",
  "www.spotify.com",
  "vimeo.com",
  "www.vimeo.com",
  "youtube.com",
  "www.youtube.com",
  "youtu.be",
  "pinterest.com",
  "www.pinterest.com",
  "pin.it",
  "substack.com",
  "medium.com",
  "www.medium.com",
  "github.com",
  "www.github.com",
  "behance.net",
  "www.behance.net",
  "dribbble.com",
  "www.dribbble.com",
  "notion.site",
];

function isAllowed(value: string) {
  try {
    const hostname = new URL(value).hostname;
    return ALLOWED_HOSTS.includes(hostname) || hostname.endsWith(".substack.com");
  } catch {
    return false;
  }
}

function isReddit(value: string) {
  try {
    return ["reddit.com", "www.reddit.com", "redd.it"].includes(new URL(value).hostname);
  } catch {
    return false;
  }
}

function getMeta(html: string, property: string) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].replace(/&amp;/g, "&");
  }
  return null;
}

export async function GET(request: Request) {
  const requestedUrl = new URL(request.url).searchParams.get("url");
  if (!requestedUrl || !isAllowed(requestedUrl)) {
    return Response.json({ error: "Unsupported preview URL." }, { status: 400 });
  }

  try {
    if (isReddit(requestedUrl)) {
      const redditUrl = requestedUrl.replace(/\/?$/, ".json");
      const redditResponse = await fetch(redditUrl, {
        signal: AbortSignal.timeout(8000),
        headers: { "User-Agent": "SpaceNote/1.0 link-preview" },
      });

      if (redditResponse.ok) {
        const payload = await redditResponse.json();
        const listing = Array.isArray(payload) ? payload[0] : payload;
        const item = listing?.data?.children?.[0]?.data;
        if (item) {
          const thumbnail = typeof item.thumbnail === "string" && item.thumbnail.startsWith("http")
            ? item.thumbnail
            : typeof item.url_overridden_by_dest === "string" && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(item.url_overridden_by_dest)
              ? item.url_overridden_by_dest
              : undefined;
          return Response.json({
            title: item.title ?? item.display_name_prefixed ?? "Reddit",
            description: item.subreddit_name_prefixed ?? "Reddit",
            thumbnail_url: thumbnail,
            url: requestedUrl,
          }, { headers: { "Cache-Control": "public, max-age=1800" } });
        }
      }
    }

    const response = await fetch(requestedUrl, {
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 Space-Note-LinkPreview" },
    });
    if (!response.ok) return Response.json({ error: "Preview unavailable." }, { status: 502 });

    const html = await response.text();
    const htmlTitle = getMeta(html, "og:title") ?? getMeta(html, "twitter:title");
    const htmlDescription = getMeta(html, "og:description") ?? getMeta(html, "twitter:description");
    if (isReddit(requestedUrl) && !htmlTitle) {
      const path = new URL(requestedUrl).pathname.replace(/\/$/, "");
      const label = path.match(/\/r\/([^/]+)/i)?.[1] ?? "Reddit";
      return Response.json({
        title: `Reddit · r/${label}`,
        description: "Otvori Reddit sadržaj.",
        thumbnail_url: null,
        url: requestedUrl,
      }, { headers: { "Cache-Control": "public, max-age=1800" } });
    }
    return Response.json(
      {
        title: htmlTitle,
        description: htmlDescription,
        thumbnail_url: getMeta(html, "og:image") ?? getMeta(html, "twitter:image"),
        url: requestedUrl,
      },
      { headers: { "Cache-Control": "public, max-age=1800" } }
    );
  } catch {
    return Response.json({ error: "Preview unavailable." }, { status: 502 });
  }
}
