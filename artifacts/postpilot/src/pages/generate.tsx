import Layout from "@/components/layout";
import { useState, useEffect, useRef } from "react";
import { useSearch } from "wouter";
import { useForm } from "react-hook-form";
import {
  useListBrands,
  useGeneratePost,
  useSaveGeneratedPost,
  getListPostsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { useWorkspace } from "@/lib/workspaceContext";
import {
  Sparkles,
  Loader2,
  Copy,
  Check,
  Save,
  RefreshCw,
  Facebook,
  Instagram,
  Linkedin,
  Image,
  FileText,
  Download,
  Send,
  CalendarClock,
  ClipboardCheck,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/friendly-error";
import { compositeLogo, compositeTextHook, type HookPosition } from "@/lib/logo-overlay";
import EngagementPredictor from "@/components/engagement-predictor";

const PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: <Facebook className="w-4 h-4 text-blue-600" /> },
  { id: "instagram", label: "Instagram", icon: <Instagram className="w-4 h-4 text-pink-600" /> },
  { id: "linkedin", label: "LinkedIn", icon: <Linkedin className="w-4 h-4 text-blue-700" /> },
];

type Mode = "text" | "image";

type FormData = {
  brandId: string;
  platforms: string[]; // multi-select — generate one post per selected platform
  topic: string;
};

type GeneratedDraft = {
  platform: string;
  content: string;
  brandId: number;
  // Per-draft action state — each platform has its own buttons + saved flag
  saved?: boolean;
  postId?: number;
  // Variant mode — when the user clicks "Get 3 angles" we re-fetch with
  // count:3 and store the alternatives here. `content` always mirrors the
  // currently-selected variant so existing publish/schedule logic keeps
  // working unchanged.
  variants?: string[];
  variantsLoading?: boolean;
  activeVariant?: number;
};

export default function GeneratePage() {
  const { data: brands } = useListBrands();
  const generatePost = useGeneratePost();
  const savePost = useSaveGeneratedPost();
  const queryClient = useQueryClient();
  const { getToken } = useAuth();

  // Reactively switch tab when URL changes (e.g. sidebar click)
  const search = useSearch();
  const tabFromUrl = (() => {
    const tab = new URLSearchParams(search).get("tab");
    if (tab === "image") return "image" as Mode;
    return "text" as Mode;
  })();
  const [mode, setMode] = useState<Mode>(tabFromUrl);
  useEffect(() => { setMode(tabFromUrl); }, [tabFromUrl]);

  // Deep-link support: /generate?brandId=42&topic=…  — used by the daily
  // Topic Suggester widget on the Dashboard to drop the user straight into
  // a pre-filled generate session. We pull the params here and feed them
  // into the form once it has mounted (and once brands have loaded so the
  // brand dropdown has options to select from).
  const deepLinkBrandId = (() => {
    const v = new URLSearchParams(search).get("brandId");
    return v && /^\d+$/.test(v) ? v : null;
  })();
  const deepLinkTopic = new URLSearchParams(search).get("topic");

  // Track which deep-link values we've already applied to the form. Once
  // we apply a value, we never re-apply it — even if the URL stays the
  // same — so a user typing in the topic field after arriving from the
  // Topic Suggester is never silently overwritten by a re-render.
  const appliedDeepLinkRef = useRef<{ brandId?: string; topic?: string }>({});
  useEffect(() => {
    if (deepLinkBrandId && appliedDeepLinkRef.current.brandId !== deepLinkBrandId) {
      setValue("brandId", deepLinkBrandId);
      appliedDeepLinkRef.current.brandId = deepLinkBrandId;
    }
    if (deepLinkTopic && appliedDeepLinkRef.current.topic !== deepLinkTopic) {
      setValue("topic", deepLinkTopic);
      appliedDeepLinkRef.current.topic = deepLinkTopic;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkBrandId, deepLinkTopic]);

  // Multi-platform output: one generated draft per platform the user ticked.
  // Replaces the old single-platform state. Each draft renders its own preview
  // card with independent action buttons (Publish/Schedule/Approval).
  const [drafts, setDrafts] = useState<GeneratedDraft[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // Local pending state — replaces generating which doesn't
  // work for parallel calls (mutation hook is a singleton).
  const [generating, setGenerating] = useState(false);

  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  // Photography style picker — passed through to the image-brief enhancer.
  // "auto" lets Claude pick based on industry + topic; the other options are
  // hard directives that force a specific photographic archetype.
  const [imageStyle, setImageStyle] = useState<
    "auto" | "scroll_stopper" | "product_hero" | "lifestyle" | "editorial" | "minimalist_studio" | "documentary" | "flat_lay"
  >("scroll_stopper");
  // Logo overlay — applied client-side AFTER the AI image renders. We never
  // ask the AI to render the logo because models reliably mangle text + logos;
  // a canvas composite guarantees the user's exact uploaded logo lands cleanly.
  type LogoPos = "none" | "bottom_right" | "bottom_left" | "top_right" | "top_left" | "centered_footer";
  const [logoPosition, setLogoPosition] = useState<LogoPos>("bottom_right");
  // Keep the raw AI image around so the user can change logo position
  // without re-generating (which costs a credit).
  const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
  // Text-hook overlay — the biggest scroll-stopper lever. A bold caption-style
  // hook drawn crisply on the image (NOT rendered by the AI, which garbles
  // text). Empty hookText = no overlay, so this is opt-in. Re-composites for
  // free when the user edits the text or moves it.
  const [hookText, setHookText] = useState("");
  const [hookPosition, setHookPosition] = useState<HookPosition>("bottom");
  const [hookLoading, setHookLoading] = useState(false);
  // Variant generation — when ON, ask the server for 3 distinct images and
  // let the user pick the best. Costs 3 credits instead of 1.
  const [variantsMode, setVariantsMode] = useState(false);
  const [variants, setVariants] = useState<Array<{ rawUrl: string; prompt: string }>>([]);
  const [activeVariant, setActiveVariant] = useState(0);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: { brandId: "", platforms: ["facebook", "instagram", "linkedin"], topic: "" },
  });

  const selectedPlatforms = watch("platforms") ?? [];
  function togglePlatform(id: string) {
    const next = selectedPlatforms.includes(id)
      ? selectedPlatforms.filter((p) => p !== id)
      : [...selectedPlatforms, id];
    setValue("platforms", next);
  }

  const selectedBrandId = watch("brandId");
  const selectedBrand = brands?.find(b => String(b.id) === selectedBrandId);

  async function onGenerate(data: FormData) {
    const platforms = data.platforms ?? [];
    if (platforms.length === 0) {
      toast.error("Pick at least one platform");
      return;
    }
    setDrafts([]); // clear previous batch
    setGeneratedImageUrl(null);
    setGenerating(true);

    // We can't use generatePost.mutate() in parallel — React Query's
    // useMutation is a singleton that overwrites pending state, so only the
    // last call's callbacks fire. For parallel multi-platform generation we
    // hit the API directly via fetch and accumulate drafts as they arrive.
    const token = await getToken();
    await Promise.all(
      platforms.map(async (platform) => {
        try {
          const res = await fetch("/api/generate", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              brandId: Number(data.brandId),
              platform,
              topic: data.topic || null,
            }),
          });
          const body = await res.json();
          if (!res.ok) {
            const code = body?.code;
            const msg = body?.error ?? `Failed to generate ${platform} post`;
            if (code === "quota_exceeded") {
              toast.error(msg, { action: { label: "Upgrade", onClick: () => (window.location.href = "/billing") } });
            } else {
              toast.error(msg);
            }
            return;
          }
          const draft: GeneratedDraft = {
            platform,
            content: body.content,
            brandId: Number(data.brandId),
          };
          // Functional update — multiple parallel finishes race on setDrafts.
          setDrafts((d) => [...d.filter((x) => x.platform !== platform), draft]);
        } catch (err: any) {
          toast.error(`Couldn't generate ${platform}: ${friendlyError(err, "try again in a moment.")}`);
        }
      }),
    );
    setGenerating(false);
  }

  async function onGenerateImage(data: FormData) {
    if (!data.brandId) {
      toast.error("Please select a brand first");
      return;
    }
    setImageLoading(true);
    setGeneratedImageUrl(null);
    try {
      const token = await getToken();
      if (!token) {
        toast.error("Your session has expired. Please sign in again.");
        return;
      }
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          brandId: Number(data.brandId),
          postContent: data.topic || `${selectedBrand?.name} brand image`,
          // Image gen targets a single platform — use the first selected one
          // (FB/IG/LI use the same square 1:1 prompt anyway).
          platform: (data.platforms ?? [])[0] ?? "facebook",
          topic: data.topic || null,
          style: imageStyle,
          count: variantsMode ? 3 : 1,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.code === "quota_exceeded") {
          toast.error(json.error, { action: { label: "Upgrade", onClick: () => (window.location.href = "/billing") } });
          return;
        }
        throw new Error(json.error ?? "Image generation failed");
      }
      // The server returns either a single image OR a `variants` array of
      // {imageUrl, prompt}. Normalize to an array so the UI is the same in
      // both cases — when only 1 came back, just show one variant card.
      const rawVariants: Array<{ rawUrl: string; prompt: string }> = Array.isArray(json.variants)
        ? json.variants.map((v: any) => ({ rawUrl: v.imageUrl, prompt: v.prompt }))
        : [{ rawUrl: json.imageUrl, prompt: json.prompt }];
      setVariants(rawVariants);
      setActiveVariant(0);
      // Keep the active variant's raw URL so logo-overlay re-composites
      // without re-generating.
      const primary = rawVariants[0].rawUrl;
      setRawImageUrl(primary);
      // Apply logo overlay, then the text hook, to the active variant. Both
      // are crisp canvas composites — never AI-rendered.
      const logoUri = selectedBrand?.logos?.[0] ?? null;
      let composed = primary;
      if (logoUri && logoPosition !== "none") {
        try { composed = await compositeLogo(composed, logoUri, logoPosition); } catch { /* keep prior */ }
      }
      if (hookText.trim() && hookPosition !== "none") {
        try { composed = await compositeTextHook(composed, hookText, hookPosition); } catch { /* keep prior */ }
      }
      setGeneratedImageUrl(composed);
      if (rawVariants.length > 1) {
        toast.success(`${rawVariants.length} variants ready — tap any to pick`);
      }
    } catch (err: any) {
      toast.error(friendlyError(err, "Couldn't generate the image. Try regenerating in a moment."));
    } finally {
      setImageLoading(false);
    }
  }

  // Ask the AI to write a short scroll-stopping hook for the image overlay.
  // Tiny text call — no image credit. Fills the hook field with the result.
  async function onAutoWriteHook() {
    const brandId = watch("brandId");
    if (!brandId) {
      toast.error("Pick a brand first so the hook fits your audience");
      return;
    }
    setHookLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error("Your session has expired. Please sign in again.");
        return;
      }
      const res = await fetch("/api/generate/hook", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brandId: Number(brandId), topic: watch("topic") || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Couldn't write a hook");
      if (json?.hook) {
        setHookText(json.hook);
        if (hookPosition === "none") setHookPosition("bottom");
      }
    } catch (err: any) {
      toast.error(friendlyError(err, "Couldn't write a hook right now. Try again in a moment."));
    } finally {
      setHookLoading(false);
    }
  }

  // Re-composite when the user changes the logo position, edits the text
  // hook / its position, OR picks a different variant. Free (no API call).
  useEffect(() => {
    if (!rawImageUrl) return;
    const logoUri = selectedBrand?.logos?.[0] ?? null;
    const hasLogo = !!logoUri && logoPosition !== "none";
    const hasHook = hookText.trim().length > 0 && hookPosition !== "none";
    if (!hasLogo && !hasHook) {
      setGeneratedImageUrl(rawImageUrl);
      return;
    }
    let cancelled = false;
    (async () => {
      let out = rawImageUrl;
      if (hasLogo) {
        try { out = await compositeLogo(out, logoUri as string, logoPosition); } catch { /* keep */ }
      }
      if (hasHook) {
        try { out = await compositeTextHook(out, hookText, hookPosition); } catch { /* keep */ }
      }
      if (!cancelled) setGeneratedImageUrl(out);
    })();
    return () => {
      cancelled = true;
    };
    // selectedBrand isn't in deps on purpose — switching brands resets the
    // image anyway via onGenerateImage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoPosition, rawImageUrl, hookText, hookPosition]);

  // When the user picks a different variant, swap the raw URL the logo
  // overlay effect is fed off of. activeVariant is the index into `variants`.
  useEffect(() => {
    if (!variants[activeVariant]) return;
    setRawImageUrl(variants[activeVariant].rawUrl);
  }, [activeVariant, variants]);

  // Per-draft copy is inlined in the preview cards below. The legacy single-
  // post handleCopy + global copied state was removed when we migrated to the
  // multi-platform drafts array.

  // ── New action handlers replacing "Save to History" ─────────────────────────
  // Three real CTAs for a generated post: publish immediately, schedule for
  // later, or send to approval queue. Each handler chains the API calls that
  // were previously done manually (save → submit → approve → retry).

  // Tracks per-draft action in flight so only the targeted card shows spinner.
  const [actionBusy, setActionBusy] = useState<null | { platform: string; kind: "publish" | "schedule" | "approval" }>(null);
  const [scheduleTarget, setScheduleTarget] = useState<string | null>(null); // platform key

  function getDraft(platform: string): GeneratedDraft | undefined {
    return drafts.find((d) => d.platform === platform);
  }

  async function savePostAndGetId(platform: string): Promise<number | null> {
    const draft = getDraft(platform);
    if (!draft) return null;
    // If already saved, reuse the postId rather than creating a duplicate row.
    if (draft.postId) return draft.postId;
    try {
      const result = await new Promise<any>((resolve, reject) => {
        savePost.mutate(
          {
            data: {
              brandId: draft.brandId,
              platform: draft.platform,
              content: draft.content,
              status: "generated",
            },
          },
          { onSuccess: resolve, onError: reject },
        );
      });
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      const postId = result?.id ?? result?.data?.id ?? null;
      // Remember postId on the draft so subsequent actions don't re-save
      setDrafts((arr) => arr.map((d) => (d.platform === platform ? { ...d, saved: true, postId } : d)));
      return postId;
    } catch {
      toast.error("Couldn't save post — try again");
      return null;
    }
  }

  async function authedFetch(url: string, opts: RequestInit = {}) {
    const token = await getToken();
    return fetch(url, {
      ...opts,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(opts.headers ?? {}),
      },
    });
  }

  // "Get 3 angles" — re-fetch this platform's caption with count:3 so the
  // user gets three distinct hook archetypes (contrarian / story-tease /
  // stat / observation / question / list-tease) to pick from. Cheap re-roll
  // when the first draft doesn't quite land.
  async function handleGenerateAngles(platform: string) {
    const draft = drafts.find((d) => d.platform === platform);
    if (!draft || draft.variantsLoading) return;
    setDrafts((arr) => arr.map((d) => (d.platform === platform ? { ...d, variantsLoading: true } : d)));
    try {
      const token = await getToken();
      const topic = watch("topic") || null;
      const res = await fetch("/api/generate", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          brandId: draft.brandId,
          platform,
          topic,
          count: 3,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body?.code === "quota_exceeded") {
          toast.error(body.error, { action: { label: "Upgrade", onClick: () => (window.location.href = "/billing") } });
        } else {
          toast.error(friendlyError(body, "Couldn't generate angles. Please try again."));
        }
        return;
      }
      const variants: string[] = Array.isArray(body.variants) && body.variants.length > 0
        ? body.variants
        : [body.content];
      setDrafts((arr) => arr.map((d) =>
        d.platform === platform
          ? { ...d, content: variants[0], variants, activeVariant: 0, saved: false, postId: undefined }
          : d,
      ));
      if (variants.length > 1) toast.success(`${variants.length} angles ready — tap one`);
    } catch (err: any) {
      toast.error(friendlyError(err, "Couldn't generate angles. Please try again."));
    } finally {
      setDrafts((arr) => arr.map((d) => (d.platform === platform ? { ...d, variantsLoading: false } : d)));
    }
  }

  // When the user picks a different variant, swap it into `content` so the
  // publish/schedule actions operate on the chosen text. Re-save resets the
  // saved flag since the post hasn't been persisted with this text yet.
  function pickVariant(platform: string, idx: number) {
    setDrafts((arr) => arr.map((d) =>
      d.platform === platform && d.variants
        ? { ...d, content: d.variants[idx], activeVariant: idx, saved: false, postId: undefined }
        : d,
    ));
  }

  async function handlePublishNow(platform: string) {
    if (actionBusy) return;
    setActionBusy({ platform, kind: "publish" });
    try {
      const postId = await savePostAndGetId(platform);
      if (!postId) return;
      await authedFetch(`/api/posts/${postId}/submit`, { method: "POST" });
      const approveRes = await authedFetch(`/api/posts/${postId}/approve`, {
        method: "POST",
        body: JSON.stringify({ publish: true }),
      });
      if (!approveRes.ok) throw new Error("Approve failed");
      const detail = await approveRes.json();
      if (detail?.publishResult?.ok === false || detail?.status === "failed") {
        await authedFetch(`/api/posts/${postId}/retry`, { method: "POST" });
      }
      toast.success(`🚀 Published to ${platform}`);
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    } catch (e: any) {
      toast.error(`Publish to ${platform} failed: ${friendlyError(e, "try again in a moment.")}`);
    } finally {
      setActionBusy(null);
    }
  }

  async function handleSendToApproval(platform: string) {
    if (actionBusy) return;
    setActionBusy({ platform, kind: "approval" });
    try {
      const postId = await savePostAndGetId(platform);
      if (!postId) return;
      const res = await authedFetch(`/api/posts/${postId}/submit`, { method: "POST" });
      if (!res.ok) throw new Error("Submit failed");
      toast.success(`Sent to approval queue (${platform})`);
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
    } catch (e: any) {
      toast.error(`Couldn't send to approval: ${friendlyError(e, "try again in a moment.")}`);
    } finally {
      setActionBusy(null);
    }
  }

  async function handleSchedule(platform: string, scheduledFor: string) {
    if (actionBusy) return;
    setActionBusy({ platform, kind: "schedule" });
    try {
      const postId = await savePostAndGetId(platform);
      if (!postId) return;
      const res = await authedFetch(`/api/approval/posts/${postId}`, {
        method: "PATCH",
        body: JSON.stringify({ scheduledFor, status: "scheduled" }),
      });
      if (!res.ok) throw new Error("Schedule failed");
      toast.success(`📅 ${platform} scheduled for ${new Date(scheduledFor).toLocaleString()}`);
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      setScheduleTarget(null);
    } catch (e: any) {
      toast.error(`Schedule failed: ${friendlyError(e, "try again in a moment.")}`);
    } finally {
      setActionBusy(null);
    }
  }

  async function handlePublishAll() {
    for (const d of drafts) {
      await handlePublishNow(d.platform);
    }
  }

  async function handleDownloadImage() {
    if (!generatedImageUrl) return;
    try {
      const blob = await fetch(generatedImageUrl).then(r => r.blob());
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `post-image-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(generatedImageUrl, "_blank");
    }
  }

  return (
    <Layout>
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Generate Content</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create AI-powered social media content instantly</p>
        </div>

        {/* Mode Tabs — plain English nouns. Audit asked for less jargon. */}
        <div className="flex gap-1 bg-secondary p-1 rounded-xl w-fit">
          {[
            { id: "text" as Mode, label: "Caption", icon: <FileText className="w-4 h-4" /> },
            { id: "image" as Mode, label: "Image", icon: <Image className="w-4 h-4" /> },
          ].map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Settings Form (shared across all modes) */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground text-sm">
              {mode === "text" ? "Post Settings" : "Image Settings"}
            </h2>

            <form
              onSubmit={handleSubmit(mode === "text" ? onGenerate : onGenerateImage)}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Brand *</label>
                <select
                  {...register("brandId", { required: "Please select a brand" })}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">Select a brand...</option>
                  {brands?.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
                {errors.brandId && <p className="text-destructive text-xs mt-1">{errors.brandId.message}</p>}
              </div>

              {selectedBrand && (
                <div className="bg-secondary rounded-lg px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedBrand.industry}</span>
                  {" · "}
                  <span className="capitalize">{selectedBrand.tone}</span>
                  {" · "}
                  <span>{selectedBrand.targetAudience}</span>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Platforms <span className="text-muted-foreground font-normal">(pick one or more)</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {PLATFORMS.map(({ id, label, icon }) => {
                    const checked = selectedPlatforms.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => togglePlatform(id)}
                        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          checked
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:bg-secondary"
                        }`}
                      >
                        {icon}
                        {label}
                        {checked && <Check className="w-3.5 h-3.5 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  AI generates a platform-specific draft for each selection — Instagram captions, Facebook tone, LinkedIn voice.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  {mode === "image" ? "Image Theme" : "Topic"}{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  {...register("topic")}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder={
                    mode === "image"
                      ? "e.g. Summer sale, product showcase..."
                      : "e.g. New product launch, holiday promotion..."
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">Leave blank for AI to decide</p>
              </div>

              {/* Advanced image controls — collapsed by default. Audit
                  asked for progressive disclosure: brand + topic + go is
                  the 80% case. Power users open this to tune style, logo
                  overlay, and variants. */}
              {mode === "image" && (
                <details className="group rounded-lg border border-border bg-secondary/30">
                  <summary className="flex items-center justify-between cursor-pointer px-3 py-2 list-none">
                    <span className="text-sm font-medium text-foreground">Advanced image controls</span>
                    <span className="text-muted-foreground group-open:rotate-45 transition-transform text-lg leading-none">+</span>
                  </summary>
                  <div className="px-3 pb-3 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Photography style{" "}
                    <span className="text-muted-foreground font-normal">(big quality lever)</span>
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {([
                      { id: "scroll_stopper", label: "🛑 Scroll-stopper", hint: "Face/emotion, bold, native" },
                      { id: "auto", label: "Auto", hint: "AI picks" },
                      { id: "product_hero", label: "Product hero", hint: "Studio product shot" },
                      { id: "lifestyle", label: "Lifestyle", hint: "Person + product, candid" },
                      { id: "editorial", label: "Editorial", hint: "Magazine-cover feel" },
                      { id: "minimalist_studio", label: "Minimalist", hint: "Clean studio" },
                      { id: "flat_lay", label: "Flat lay", hint: "Top-down arrangement" },
                      { id: "documentary", label: "Documentary", hint: "Real, candid moment" },
                    ] as const).map(({ id, label, hint }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setImageStyle(id)}
                        className={`text-left border rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                          imageStyle === id
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-foreground hover:bg-secondary"
                        }`}
                      >
                        <div className="font-medium">{label}</div>
                        <div className="text-[10px] text-muted-foreground">{hint}</div>
                      </button>
                    ))}
                  </div>
                </div>

              {/* Text-hook overlay — the biggest scroll-stopper lever. Drawn
                  crisply on-canvas (NOT by the AI, which garbles text). Edits
                  re-composite for free, no new credit. */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    Text hook{" "}
                    <span className="text-muted-foreground font-normal">(stops the scroll — keep it short)</span>
                  </label>
                  <button
                    type="button"
                    onClick={onAutoWriteHook}
                    disabled={hookLoading}
                    className="text-xs font-medium text-primary hover:underline disabled:opacity-50 disabled:no-underline whitespace-nowrap"
                  >
                    {hookLoading ? "Writing…" : "✨ Auto-write"}
                  </button>
                </div>
                <input
                  type="text"
                  value={hookText}
                  maxLength={70}
                  onChange={(e) => setHookText(e.target.value)}
                  placeholder='e.g. "The mistake 90% of sellers make"'
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <div className="grid grid-cols-4 gap-1.5 mt-1.5">
                  {([
                    { id: "none", label: "Off" },
                    { id: "top", label: "↑ Top" },
                    { id: "center", label: "Center" },
                    { id: "bottom", label: "↓ Bottom" },
                  ] as const).map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setHookPosition(id)}
                      className={`text-center border rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                        hookPosition === id
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-border text-foreground hover:bg-secondary"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Crisp, correctly-spelled text — we draw it on top, so it never comes out warped like AI-generated text.
                </p>
              </div>

              {/* Logo overlay picker — only shown when a brand with a logo is
                  selected. Composited client-side after Nano Banana renders;
                  changing position re-composites for free (no new credit). */}
              {(selectedBrand?.logos?.length ?? 0) > 0 && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Brand logo overlay{" "}
                    <span className="text-muted-foreground font-normal">(crisp, not AI-generated)</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {([
                      { id: "none", label: "None" },
                      { id: "bottom_right", label: "↘ Bottom-right" },
                      { id: "bottom_left", label: "↙ Bottom-left" },
                      { id: "top_right", label: "↗ Top-right" },
                      { id: "top_left", label: "↖ Top-left" },
                      { id: "centered_footer", label: "↓ Centered" },
                    ] as const).map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setLogoPosition(id)}
                        className={`text-center border rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                          logoPosition === id
                            ? "border-primary bg-primary/5 text-primary"
                            : "border-border text-foreground hover:bg-secondary"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5">
                    We overlay your <strong>exact uploaded logo</strong> on a subtle backdrop — no AI-warped text or fake logos.
                  </p>
                </div>
              )}
              {(selectedBrand?.logos?.length ?? 0) === 0 && selectedBrand && (
                <div className="bg-secondary/30 border border-dashed border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">
                    💡 Upload a logo on your brand to overlay it on every generated image.
                  </p>
                </div>
              )}

              {/* Variants toggle — when ON, generate 3 distinct briefs in
                  parallel for 3 credits. Big quality lever when a single
                  generation doesn't quite land. */}
              <div className="flex items-start gap-3 rounded-lg border border-border bg-secondary/20 p-3">
                  <input
                    id="variants-toggle"
                    type="checkbox"
                    checked={variantsMode}
                    onChange={(e) => setVariantsMode(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-primary cursor-pointer"
                  />
                  <label htmlFor="variants-toggle" className="flex-1 cursor-pointer">
                    <div className="text-sm font-medium text-foreground">
                      Generate 3 variants <span className="font-normal text-muted-foreground">(3 credits)</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      AI writes 3 distinct briefs — different angles, lighting, mood. Pick the best.
                    </div>
                  </label>
                </div>
                  </div>
                </details>
              )}

              <button
                type="submit"
                disabled={generating || imageLoading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-60"
              >
                {(generating || imageLoading) ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />
                    {mode === "image" ? "Generating image..." : "Generating..."}
                  </>
                ) : (
                  <>
                    {mode === "image" ? <Image className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    {mode === "image" ? "Generate Image" : "Generate Post"}
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Preview Panel */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
            {/* TEXT MODE */}
            {mode === "text" && (
              <>
                <h2 className="font-semibold text-foreground text-sm mb-4">Post Preview</h2>
                {drafts.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-3">
                      <Sparkles className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">Your generated posts will appear here — one per platform</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
                    {/* Top-level batch actions when 2+ drafts present */}
                    {drafts.length > 1 && (
                      <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
                        <span className="text-xs font-medium text-foreground">
                          {drafts.length} drafts generated
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSubmit(onGenerate)()}
                            disabled={generating || !!actionBusy}
                            className="flex items-center gap-1 text-xs font-medium border border-border bg-card px-2.5 py-1 rounded-md hover:bg-secondary disabled:opacity-60"
                          >
                            <RefreshCw className={`w-3 h-3 ${generating ? "animate-spin" : ""}`} />
                            Regenerate all
                          </button>
                          <button
                            onClick={handlePublishAll}
                            disabled={!!actionBusy}
                            className="flex items-center gap-1 text-xs font-semibold bg-primary text-primary-foreground px-2.5 py-1 rounded-md hover:opacity-90 disabled:opacity-60"
                          >
                            <Send className="w-3 h-3" />
                            Publish all
                          </button>
                        </div>
                      </div>
                    )}
                    {drafts
                      .slice()
                      .sort((a, b) => PLATFORMS.findIndex((p) => p.id === a.platform) - PLATFORMS.findIndex((p) => p.id === b.platform))
                      .map((draft) => {
                        const plat = PLATFORMS.find((p) => p.id === draft.platform);
                        const busy = actionBusy?.platform === draft.platform;
                        return (
                          <div key={draft.platform} className="border border-border rounded-lg bg-card p-3">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              {plat?.icon}
                              <span className="text-sm font-medium text-foreground capitalize">{draft.platform}</span>
                              <span className="text-xs text-muted-foreground">· {brands?.find((b) => b.id === draft.brandId)?.name}</span>
                              {/* Engagement prediction — lazy fires after the draft
                                  appears. Scored against the brand's performance
                                  memory; cached server-side so variant switches
                                  re-use the same score. */}
                              <EngagementPredictor
                                brandId={draft.brandId}
                                content={draft.content}
                                platform={draft.platform}
                              />
                              {draft.saved && (
                                <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Saved</span>
                              )}
                            </div>
                            <div className="bg-secondary rounded-md p-3 mb-3 max-h-48 overflow-y-auto">
                              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{draft.content}</p>
                            </div>
                            {/* Variant tabs — only shown after the user has
                                fetched alternatives via "Get 3 angles". Each
                                tab swaps the displayed caption client-side
                                with no new API call. Each tab ALSO shows the
                                engagement prediction inline so user can pick
                                the best-scoring angle at a glance. */}
                            {draft.variants && draft.variants.length > 1 && (
                              <div className="flex gap-1 mb-3">
                                {draft.variants.map((variantContent, i) => (
                                  <VariantTab
                                    key={i}
                                    index={i}
                                    isActive={i === (draft.activeVariant ?? 0)}
                                    content={variantContent}
                                    brandId={draft.brandId}
                                    platform={draft.platform}
                                    onPick={() => pickVariant(draft.platform, i)}
                                  />
                                ))}
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                onClick={async () => {
                                  await navigator.clipboard.writeText(draft.content);
                                  setCopiedKey(draft.platform);
                                  setTimeout(() => setCopiedKey(null), 1500);
                                  toast.success("Copied");
                                }}
                                className="flex items-center gap-1 text-[11px] font-medium border border-border px-2 py-1 rounded-md hover:bg-secondary"
                              >
                                {copiedKey === draft.platform ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />}
                                Copy
                              </button>
                              <button
                                onClick={() => handleGenerateAngles(draft.platform)}
                                disabled={!!draft.variantsLoading || !!actionBusy}
                                className="flex items-center gap-1 text-[11px] font-medium border border-primary/30 text-primary px-2 py-1 rounded-md hover:bg-primary/5 disabled:opacity-60"
                                title="Generate 3 alternative captions in different hook angles"
                              >
                                {draft.variantsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                                {draft.variants ? "New angles" : "Get 3 angles"}
                              </button>
                              <div className="flex-1" />
                              <button
                                onClick={() => handlePublishNow(draft.platform)}
                                disabled={!!actionBusy}
                                className="flex items-center gap-1 text-xs font-semibold bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md hover:opacity-90 disabled:opacity-60"
                              >
                                {busy && actionBusy?.kind === "publish" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                Publish
                              </button>
                              <button
                                onClick={() => setScheduleTarget(draft.platform)}
                                disabled={!!actionBusy}
                                className="flex items-center gap-1 text-xs font-semibold border border-border text-foreground px-2.5 py-1.5 rounded-md hover:bg-secondary disabled:opacity-60"
                              >
                                {busy && actionBusy?.kind === "schedule" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarClock className="w-3.5 h-3.5" />}
                                Schedule
                              </button>
                              <button
                                onClick={() => handleSendToApproval(draft.platform)}
                                disabled={!!actionBusy}
                                className="flex items-center gap-1 text-xs font-semibold border border-border text-foreground px-2.5 py-1.5 rounded-md hover:bg-secondary disabled:opacity-60"
                              >
                                {busy && actionBusy?.kind === "approval" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                                Approval
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    {scheduleTarget && (() => {
                      // Look up the draft for this platform so we can pass
                      // its brandId to the schedule dialog for smart-time
                      // suggestion.
                      const scheduleDraft = drafts.find((d) => d.platform === scheduleTarget);
                      return (
                        <ScheduleDialog
                          onCancel={() => setScheduleTarget(null)}
                          onConfirm={(iso) => handleSchedule(scheduleTarget, iso)}
                          busy={actionBusy?.kind === "schedule"}
                          brandId={scheduleDraft?.brandId}
                          platform={scheduleTarget}
                        />
                      );
                    })()}
                  </div>
                )}
              </>
            )}

            {/* IMAGE MODE */}
            {mode === "image" && (
              <>
                <h2 className="font-semibold text-foreground text-sm mb-4">Generated Image</h2>
                {imageLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">AI is creating your image...</p>
                    <p className="text-xs text-muted-foreground">This may take 10–20 seconds</p>
                  </div>
                ) : !generatedImageUrl ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-3">
                      <Image className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">Your AI-generated image will appear here</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Pro brief → Gemini Flash · brand colors + reference logo carried through
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-3">
                    <div className="rounded-lg overflow-hidden border border-border aspect-square bg-muted">
                      <img
                        src={generatedImageUrl}
                        alt="AI generated post image"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Variant thumbnail strip — only shows when >1 variant.
                        Click any thumbnail to make it the active image. */}
                    {variants.length > 1 && (
                      <div className="flex gap-2">
                        {variants.map((v, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setActiveVariant(i)}
                            className={`flex-1 aspect-square rounded-md overflow-hidden border-2 transition-colors ${
                              i === activeVariant ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                            }`}
                            aria-label={`Pick variant ${i + 1}`}
                          >
                            <img src={v.rawUrl} alt={`Variant ${i + 1}`} className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={handleDownloadImage}
                        className="flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </button>
                      <button
                        onClick={() => handleSubmit(onGenerateImage)()}
                        disabled={imageLoading}
                        className="flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${imageLoading ? "animate-spin" : ""}`} />
                        New Image
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(generatedImageUrl);
                          toast.success("Image URL copied");
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors ml-auto"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy URL
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      </div>
    </Layout>
  );
}

// ── Schedule dialog ─────────────────────────────────────────────────────────
// Variant tab — fetches its own engagement-prediction score against the
// brand's performance memory and shows it inline as a tiny badge. The
// `/api/predict/engagement` endpoint caches by content+brand, so all N
// variants in a draft each get exactly one Claude call regardless of how
// often the user clicks around.
function VariantTab({
  index,
  isActive,
  content,
  brandId,
  platform,
  onPick,
}: {
  index: number;
  isActive: boolean;
  content: string;
  brandId: number;
  platform: string;
  onPick: () => void;
}) {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    if (!brandId || !content || content.length < 10) return;
    const ctl = new AbortController();
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch("/api/predict/engagement", {
          method: "POST",
          credentials: "include",
          signal: ctl.signal,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(activeWorkspace ? { "X-Workspace-Id": String(activeWorkspace.id) } : {}),
          },
          body: JSON.stringify({ brandId, content, platform }),
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!ctl.signal.aborted) setScore(json.score ?? null);
      } catch { /* silent — score badge is non-critical */ }
    })();
    return () => { ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, content.slice(0, 200), platform]);

  // Color the score badge by tier. Same hue family in light + dark.
  let scoreCls = "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300";
  if (score && score >= 4) scoreCls = "bg-emerald-100 dark:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300";
  else if (score === 3) scoreCls = "bg-amber-100 dark:bg-amber-500/25 text-amber-700 dark:text-amber-300";
  else if (score && score <= 2) scoreCls = "bg-rose-100 dark:bg-rose-500/25 text-rose-700 dark:text-rose-300";

  return (
    <button
      type="button"
      onClick={onPick}
      className={`flex-1 text-[11px] font-medium px-2 py-1.5 rounded-md border transition-colors flex items-center justify-center gap-1.5 ${
        isActive
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-secondary"
      }`}
    >
      <span>Angle {index + 1}</span>
      {score !== null && (
        <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${scoreCls}`}>{score}/5</span>
      )}
    </button>
  );
}

// Lightweight inline dialog (no shadcn dependency needed). Uses native
// datetime-local input so it just works on every browser. Default value is
// 1 hour from now in user's local timezone — covers the common "post this
// later today" case without making them think.
function ScheduleDialog({
  onCancel,
  onConfirm,
  busy,
  brandId,
  platform,
}: {
  onCancel: () => void;
  onConfirm: (iso: string) => void;
  busy: boolean;
  // Optional — when provided, we fetch the brand's optimal posting hour
  // from performance memory and use it as the dialog's initial value.
  brandId?: number;
  platform?: string;
}) {
  const { getToken } = useAuth();
  const { activeWorkspace } = useWorkspace();

  function toLocalInput(d: Date): string {
    const off = d.getTimezoneOffset() * 60 * 1000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  }

  const fallback = toLocalInput(new Date(Date.now() + 60 * 60 * 1000));
  const [value, setValue] = useState(fallback);
  const [suggested, setSuggested] = useState<{ iso: string; hour: number } | null>(null);

  // Fetch the brand's best-performing hour for this platform and pre-fill
  // the datetime input. If no data yet, leave the default "1 hour from now".
  useEffect(() => {
    if (!brandId) return;
    const ctl = new AbortController();
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`/api/brands/${brandId}/optimal-times`, {
          credentials: "include",
          signal: ctl.signal,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(activeWorkspace ? { "X-Workspace-Id": String(activeWorkspace.id) } : {}),
          },
        });
        if (!res.ok) return;
        const json = await res.json();
        const hit = json?.perPlatform?.[platform ?? "instagram"];
        if (hit && hit.nextIso) {
          if (!ctl.signal.aborted) {
            setSuggested({ iso: hit.nextIso, hour: hit.hour });
            setValue(toLocalInput(new Date(hit.nextIso)));
          }
        }
      } catch { /* silent — fallback time still works */ }
    })();
    return () => { ctl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, platform]);

  function submit() {
    if (!value) return;
    const iso = new Date(value).toISOString();
    if (new Date(iso).getTime() < Date.now()) {
      toast.error("Schedule time must be in the future.");
      return;
    }
    onConfirm(iso);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Schedule post"
        className="bg-card rounded-xl border border-border shadow-lg p-5 w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-foreground mb-1">Schedule post</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Choose when this post should publish. Times are in your local timezone.
        </p>
        {/* AI-suggested time badge — shows the user this isn't a random
            default; it's been picked from their actual performance data. */}
        {suggested && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 p-2.5">
            <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-foreground leading-snug">
              <span className="font-semibold">Suggested time pre-filled</span> — your{" "}
              <span className="capitalize">{platform ?? "social"}</span> posts perform best around this hour based on past engagement.
            </p>
          </div>
        )}
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
        <div className="flex gap-2 justify-end mt-4">
          <button
            onClick={onCancel}
            disabled={busy}
            className="text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-secondary"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex items-center gap-1.5 text-sm font-semibold bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
