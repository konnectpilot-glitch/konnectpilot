import Layout from "@/components/layout";
import { useState, useEffect } from "react";
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
  Video,
  FileText,
  Download,
  Clapperboard,
  Clock,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

const PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: <Facebook className="w-4 h-4 text-blue-600" /> },
  { id: "instagram", label: "Instagram", icon: <Instagram className="w-4 h-4 text-pink-600" /> },
  { id: "linkedin", label: "LinkedIn", icon: <Linkedin className="w-4 h-4 text-blue-700" /> },
];

type Mode = "text" | "image" | "video";

type FormData = {
  brandId: string;
  platform: string;
  topic: string;
};

interface VideoScene {
  scene: number;
  visual: string;
  voiceover: string;
  duration: string;
}

interface VideoScript {
  title?: string;
  duration?: string;
  hook?: string;
  scenes?: VideoScene[];
  callToAction?: string;
  caption?: string;
  error?: string;
}

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
    if (tab === "image" || tab === "video") return tab as Mode;
    return "text" as Mode;
  })();
  const [mode, setMode] = useState<Mode>(tabFromUrl);
  useEffect(() => { setMode(tabFromUrl); }, [tabFromUrl]);

  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [generatedPlatform, setGeneratedPlatform] = useState<string | null>(null);
  const [generatedBrandId, setGeneratedBrandId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const [videoScript, setVideoScript] = useState<VideoScript | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: { brandId: "", platform: "facebook", topic: "" },
  });

  const selectedBrandId = watch("brandId");
  const selectedPlatform = watch("platform");
  const selectedBrand = brands?.find(b => String(b.id) === selectedBrandId);

  async function onGenerate(data: FormData) {
    setSaved(false);
    setGeneratedImageUrl(null);
    generatePost.mutate(
      {
        data: {
          brandId: Number(data.brandId),
          platform: data.platform as any,
          topic: data.topic || null,
        },
      },
      {
        onSuccess: (result) => {
          setGeneratedContent(result.content);
          setGeneratedPlatform(data.platform);
          setGeneratedBrandId(Number(data.brandId));
        },
        onError: (err: any) => {
          const code = err?.data?.code;
          const msg = err?.data?.error ?? "Failed to generate post";
          if (code === "quota_exceeded") {
            toast.error(msg, { action: { label: "Upgrade", onClick: () => (window.location.href = "/billing") } });
          } else {
            toast.error(msg);
          }
        },
      }
    );
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
          platform: data.platform,
          topic: data.topic || null,
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
      setGeneratedImageUrl(json.imageUrl);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to generate image");
    } finally {
      setImageLoading(false);
    }
  }

  async function onGenerateVideo(data: FormData) {
    if (!data.brandId) {
      toast.error("Please select a brand first");
      return;
    }
    setVideoLoading(true);
    setVideoScript(null);
    try {
      const token = await getToken();
      if (!token) {
        toast.error("Your session has expired. Please sign in again.");
        return;
      }
      const res = await fetch("/api/generate/video-script", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          brandId: Number(data.brandId),
          topic: data.topic || null,
          platform: data.platform === "tiktok" || data.platform === "instagram" ? data.platform : "tiktok",
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.code === "quota_exceeded") {
          toast.error(json.error, { action: { label: "Upgrade", onClick: () => (window.location.href = "/billing") } });
          return;
        }
        throw new Error(json.error ?? "Video script generation failed");
      }
      setVideoScript(json.script);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to generate video script");
    } finally {
      setVideoLoading(false);
    }
  }

  async function handleCopy() {
    if (!generatedContent) return;
    await navigator.clipboard.writeText(generatedContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  }

  async function handleSave() {
    if (!generatedContent || !generatedPlatform || !generatedBrandId) return;
    savePost.mutate(
      {
        data: {
          brandId: generatedBrandId,
          platform: generatedPlatform,
          content: generatedContent,
          status: "generated",
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
          setSaved(true);
          toast.success("Post saved to history");
        },
        onError: () => toast.error("Failed to save post"),
      }
    );
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

  const isVideoCompatible = selectedPlatform === "tiktok" || selectedPlatform === "instagram";

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Generate Content</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create AI-powered social media content instantly</p>
        </div>

        {/* Mode Tabs */}
        <div className="flex gap-1 bg-secondary p-1 rounded-xl w-fit">
          {[
            { id: "text" as Mode, label: "Post Text", icon: <FileText className="w-4 h-4" /> },
            { id: "image" as Mode, label: "Post Image", icon: <Image className="w-4 h-4" /> },
            { id: "video" as Mode, label: "Video Script", icon: <Video className="w-4 h-4" /> },
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
              {mode === "text" ? "Post Settings" : mode === "image" ? "Image Settings" : "Video Settings"}
            </h2>

            <form
              onSubmit={handleSubmit(
                mode === "text" ? onGenerate : mode === "image" ? onGenerateImage : onGenerateVideo
              )}
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

              {mode !== "video" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Platform *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLATFORMS.filter(p => !selectedBrand || selectedBrand.platforms.includes(p.id)).map(({ id, label, icon }) => (
                      <label key={id} className="cursor-pointer">
                        <input type="radio" value={id} {...register("platform")} className="sr-only" />
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          watch("platform") === id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:bg-secondary"
                        }`}>
                          {icon}
                          {label}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {mode === "video" && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">Platform</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PLATFORMS.filter(p => p.id === "tiktok" || p.id === "instagram").map(({ id, label, icon }) => (
                      <label key={id} className="cursor-pointer">
                        <input type="radio" value={id} {...register("platform")} className="sr-only" />
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          watch("platform") === id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:bg-secondary"
                        }`}>
                          {icon}
                          {label}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

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
                      : mode === "video"
                      ? "e.g. Behind the scenes, product demo..."
                      : "e.g. New product launch, holiday promotion..."
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">Leave blank for AI to decide</p>
              </div>

              <button
                type="submit"
                disabled={generatePost.isPending || imageLoading || videoLoading}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-60"
              >
                {(generatePost.isPending || imageLoading || videoLoading) ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />
                    {mode === "image" ? "Generating image..." : mode === "video" ? "Writing script..." : "Generating..."}
                  </>
                ) : (
                  <>
                    {mode === "image" ? <Image className="w-4 h-4" /> : mode === "video" ? <Clapperboard className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                    {mode === "image" ? "Generate Image" : mode === "video" ? "Generate Video Script" : "Generate Post"}
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
                {!generatedContent ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-3">
                      <Sparkles className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">Your generated post will appear here</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      {PLATFORMS.find(p => p.id === generatedPlatform)?.icon}
                      <span className="text-sm font-medium text-foreground capitalize">{generatedPlatform}</span>
                      <span className="text-xs text-muted-foreground">· {brands?.find(b => b.id === generatedBrandId)?.name}</span>
                    </div>
                    <div className="flex-1 bg-secondary rounded-lg p-4 mb-4">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{generatedContent}</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? "Copied" : "Copy"}
                      </button>
                      <button
                        onClick={() => handleSubmit(onGenerate)()}
                        disabled={generatePost.isPending}
                        className="flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${generatePost.isPending ? "animate-spin" : ""}`} />
                        Regenerate
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={savePost.isPending || saved}
                        className="flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary px-3 py-1.5 rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-60 ml-auto"
                      >
                        {saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                        {saved ? "Saved" : "Save to History"}
                      </button>
                    </div>
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
                    <p className="text-xs text-muted-foreground mt-1">1024×1024 · Brand-aligned · DALL-E 3</p>
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

            {/* VIDEO SCRIPT MODE */}
            {mode === "video" && (
              <>
                <h2 className="font-semibold text-foreground text-sm mb-4">Video Script</h2>
                {videoLoading ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4 gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Writing your video script...</p>
                  </div>
                ) : !videoScript ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                    <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mb-3">
                      <Clapperboard className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                    <p className="text-sm text-muted-foreground">Your video script will appear here</p>
                    <p className="text-xs text-muted-foreground mt-1">Scene-by-scene · Voiceover · TikTok / Reels</p>
                  </div>
                ) : videoScript.error ? (
                  <div className="flex-1 flex items-center justify-center text-center p-4">
                    <p className="text-sm text-destructive">Script generation failed. Try again.</p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-3 overflow-auto">
                    {/* Header */}
                    <div className="bg-primary/10 rounded-lg p-3">
                      <h3 className="font-semibold text-foreground text-sm">{videoScript.title ?? "Video Script"}</h3>
                      {videoScript.duration && (
                        <div className="flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{videoScript.duration}</span>
                        </div>
                      )}
                    </div>

                    {/* Hook */}
                    {videoScript.hook && (
                      <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-amber-700 mb-1">HOOK (0–3 sec)</p>
                        <p className="text-sm text-foreground">{videoScript.hook}</p>
                      </div>
                    )}

                    {/* Scenes */}
                    {videoScript.scenes?.map((scene) => (
                      <div key={scene.scene} className="border border-border rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                            Scene {scene.scene}
                          </span>
                          <span className="text-xs text-muted-foreground">{scene.duration}</span>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">Visual</p>
                          <p className="text-sm text-foreground">{scene.visual}</p>
                        </div>
                        {scene.voiceover && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-0.5">Voiceover / Text</p>
                            <p className="text-sm text-foreground italic">"{scene.voiceover}"</p>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* CTA */}
                    {videoScript.callToAction && (
                      <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-green-700 mb-1">CALL TO ACTION</p>
                        <p className="text-sm text-foreground">{videoScript.callToAction}</p>
                      </div>
                    )}

                    {/* Caption */}
                    {videoScript.caption && (
                      <div className="border border-border rounded-lg p-3">
                        <p className="text-xs font-semibold text-muted-foreground mb-1">POST CAPTION</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{videoScript.caption}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          const text = [
                            videoScript.title,
                            `Duration: ${videoScript.duration}`,
                            `\nHOOK: ${videoScript.hook}`,
                            ...(videoScript.scenes ?? []).map(s =>
                              `\nScene ${s.scene} (${s.duration})\nVisual: ${s.visual}\nVoiceover: "${s.voiceover}"`
                            ),
                            `\nCTA: ${videoScript.callToAction}`,
                            `\nCaption: ${videoScript.caption}`,
                          ].filter(Boolean).join("\n");
                          navigator.clipboard.writeText(text);
                          toast.success("Script copied to clipboard");
                        }}
                        className="flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Copy Script
                      </button>
                      <button
                        onClick={() => handleSubmit(onGenerateVideo)()}
                        disabled={videoLoading}
                        className="flex items-center gap-1.5 text-xs font-medium border border-border px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${videoLoading ? "animate-spin" : ""}`} />
                        Regenerate
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
