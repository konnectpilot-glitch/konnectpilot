import Layout from "@/components/layout";
import { useState } from "react";
import { Link } from "wouter";
import { useListPosts } from "@workspace/api-client-react";
import type { Post } from "@workspace/api-client-react";
import { Image as ImageIcon, Download, Copy, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

type LibraryItem = Post & { imageUrl: string };

function hasImage(p: Post): p is LibraryItem {
  return typeof p.imageUrl === "string" && p.imageUrl.length > 0;
}

export default function LibraryPage() {
  const { data: posts, isLoading } = useListPosts();
  const [search, setSearch] = useState("");

  const items: LibraryItem[] = (posts ?? [])
    .filter(hasImage)
    .filter((p) =>
      !search || p.content.toLowerCase().includes(search.toLowerCase()),
    );

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    toast.success("Image URL copied");
  }

  async function download(url: string) {
    try {
      const blob = await fetch(url).then((r) => r.blob());
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `library-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Content Library</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              All your AI-generated and uploaded media in one place
            </p>
          </div>
          <Link
            href="/generate?tab=image"
            className="inline-flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Sparkles className="w-4 h-4" /> Generate Image
          </Link>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by caption..."
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
              <ImageIcon className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">
              {search ? "No matches" : "Your library is empty"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {search
                ? "Try a different search."
                : "Generate your first AI image to start building your library."}
            </p>
            {!search && (
              <Link
                href="/generate?tab=image"
                className="inline-flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90"
              >
                <Sparkles className="w-4 h-4" /> Generate Image
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-muted"
              >
                <img
                  src={item.imageUrl}
                  alt={item.content.slice(0, 80)}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                  <div className="p-3 w-full">
                    <p className="text-xs text-white/90 line-clamp-2 mb-2">
                      {item.content}
                    </p>
                    <p className="text-[10px] text-white/60 capitalize mb-2">
                      {item.platform}
                      {item.brandName ? ` · ${item.brandName}` : ""}
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => download(item.imageUrl)}
                        className="flex items-center gap-1 text-[11px] font-medium bg-white/20 backdrop-blur text-white px-2 py-1 rounded hover:bg-white/30"
                      >
                        <Download className="w-3 h-3" /> Save
                      </button>
                      <button
                        onClick={() => copyUrl(item.imageUrl)}
                        className="flex items-center gap-1 text-[11px] font-medium bg-white/20 backdrop-blur text-white px-2 py-1 rounded hover:bg-white/30"
                      >
                        <Copy className="w-3 h-3" /> URL
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
