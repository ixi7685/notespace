import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Space Note",
    short_name: "Space Note",
    description: "Privatni kreativni prostor za beleške, ideje i snimke.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#090c16",
    theme_color: "#ffb454",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/note-space-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/note-space-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
