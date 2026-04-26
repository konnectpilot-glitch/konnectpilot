import Layout from "@/components/layout";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  useListBrands,
  useGeneratePost,
  useSaveGeneratedPost,
  getListPostsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
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
} from "lucide-react";
import { FaTiktok } from "react-icons/fa";
import { toast } from "sonner";

const PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: <Facebook className="w-4 h-4 text-blue-600" /> },
  { id: "instagram", label: "Instagram", icon: <Instagram className="w-4 h-4 text-pink-600" /> },
  { id: "linkedin", label: "LinkedIn", icon: <Linkedin className="w-4 h-4 text-blue-700" /> },
  { id: "tiktok", label: "TikTok", icon: <FaTiktok className="w-3.5 h-3.5 text-foreground" /> },
];

type FormData = {
  brandId: string;
  platform: string;
  topic: string;
};

export default function GeneratePage() {
  const { data: brands } = useListBrands();
  const generatePost = useGeneratePost();
  const savePost = useSaveGeneratedPost();
  const queryClient = useQueryClient();
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [generatedPlatform, setGeneratedPlatform] = useState<string | null>(null);
  const [generatedBrandId, setGeneratedBrandId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    defaultValues: { brandId: "", platform: "facebook", topic: "" },
  });

  const selectedBrandId = watch("brandId");
  const selectedBrand = brands?.find(b => String(b.id) === selectedBrandId);

  async function onGenerate(data: FormData) {
    setSaved(false);
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
        onError: (err: any) => toast.error(err?.data?.error ?? "Failed to generate post"),
      }
    );
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

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Generate Post</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create AI-powered social media content instantly</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground text-sm">Post Settings</h2>

            <form onSubmit={handleSubmit(onGenerate)} className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Topic <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <input
                  {...register("topic")}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="e.g. New product launch, holiday promotion..."
                />
                <p className="text-xs text-muted-foreground mt-1">Leave blank for AI to pick the topic</p>
              </div>

              <button
                type="submit"
                disabled={generatePost.isPending}
                className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-60"
              >
                {generatePost.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate Post</>
                )}
              </button>
            </form>
          </div>

          {/* Preview */}
          <div className="bg-card border border-border rounded-xl p-5 flex flex-col">
            <h2 className="font-semibold text-foreground text-sm mb-4">Preview</h2>

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
                <div className="flex gap-2">
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
          </div>
        </div>
      </div>
    </Layout>
  );
}
