import Layout from "@/components/layout";
import { Link, useLocation, useSearch } from "wouter";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Instagram, Loader2 } from "lucide-react";

const BASE_URL = "";

type StagingPage = {
  pageId: string;
  pageName: string;
  pagePictureUrl: string | null;
  igAccount: {
    id: string;
    username: string;
    name?: string;
    profilePictureUrl: string | null;
  } | null;
};

type StagingResponse = {
  provider: string;
  pages: StagingPage[];
};

export default function ConnectMetaPickerPage() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  const ticket = useMemo(() => new URLSearchParams(search).get("ticket") ?? "", [search]);

  const [staging, setStaging] = useState<StagingResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [includeLinkedInstagram, setIncludeLinkedInstagram] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ticket) {
      setLoadError("Missing ticket — restart the OAuth flow from the Accounts page.");
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${BASE_URL}/api/social-accounts/staging/${ticket}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setLoadError(body?.error ?? `Failed to load (HTTP ${res.status})`);
          return;
        }
        setStaging(body);
        // Pre-select every Page by default — users typically want all of them.
        setSelected(new Set((body.pages as StagingPage[]).map((p) => p.pageId)));
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message ?? "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticket, getToken]);

  function toggle(pageId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  }

  async function handleSubmit() {
    if (selected.size === 0) {
      toast.error("Pick at least one Page.");
      return;
    }
    setSubmitting(true);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/social-accounts/staging/${ticket}/select`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pageIds: Array.from(selected),
          includeLinkedInstagram,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(body?.error ?? `Connection failed (HTTP ${res.status})`);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      toast.success(`Connected ${body.created?.length ?? 0} account(s)`);
      setLocation("/accounts");
    } catch (err: any) {
      toast.error(err?.message ?? "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link
            href="/accounts"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Pick what to connect</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              These are the Facebook Pages you administer. Select the ones KonnectPilot should manage.
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading your Pages…
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 space-y-3">
            <p className="text-sm text-destructive font-medium">Couldn't load the picker</p>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <Link
              href="/accounts"
              className="inline-block text-sm font-medium text-primary hover:underline"
            >
              ← Back to Accounts
            </Link>
          </div>
        )}

        {!loading && !loadError && staging && (
          <>
            {staging.pages.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-5 space-y-3">
                <p className="text-sm font-medium text-foreground">No Facebook Pages found</p>
                <p className="text-sm text-muted-foreground">
                  Facebook only allows posting to Pages, not personal profiles. Create a Page
                  at{" "}
                  <a
                    href="https://www.facebook.com/pages/create"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    facebook.com/pages/create
                  </a>
                  , then start the connection again from Accounts.
                </p>
                <Link
                  href="/accounts"
                  className="inline-block text-sm font-medium text-primary hover:underline"
                >
                  ← Back to Accounts
                </Link>
              </div>
            ) : (
              <>
                <div className="bg-card border border-border rounded-xl p-2 space-y-1">
                  {staging.pages.map((p) => {
                    const isSelected = selected.has(p.pageId);
                    return (
                      <label
                        key={p.pageId}
                        className={`flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? "bg-primary/10" : "hover:bg-secondary/50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(p.pageId)}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                        {p.pagePictureUrl ? (
                          <img
                            src={p.pagePictureUrl}
                            alt=""
                            className="w-10 h-10 rounded-full object-cover border border-border"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-secondary border border-border flex items-center justify-center text-xs text-muted-foreground">
                            FB
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground truncate">{p.pageName}</p>
                          <p className="text-xs text-muted-foreground">
                            ID: {p.pageId}
                          </p>
                        </div>
                        {p.igAccount ? (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-pink-700 bg-pink-50 border border-pink-100 px-2 py-1 rounded-full">
                            <Instagram className="w-3 h-3" />
                            IG: @{p.igAccount.username}
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-muted-foreground bg-secondary border border-border px-2 py-1 rounded-full">
                            FB only
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>

                <label className="flex items-center gap-2 text-sm text-foreground select-none">
                  <input
                    type="checkbox"
                    checked={includeLinkedInstagram}
                    onChange={(e) => setIncludeLinkedInstagram(e.target.checked)}
                    className="w-4 h-4 accent-primary cursor-pointer"
                  />
                  Also import linked Instagram Business accounts
                </label>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-muted-foreground">
                    {selected.size} of {staging.pages.length} Page(s) selected
                  </p>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || selected.size === 0}
                    className="flex items-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Connect selected
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
