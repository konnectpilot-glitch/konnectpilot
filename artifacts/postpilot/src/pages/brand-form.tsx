import Layout from "@/components/layout";
import { Link, useRoute, useLocation } from "wouter";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  useGetBrand,
  useCreateBrand,
  useUpdateBrand,
  getListBrandsQueryKey,
  getGetBrandQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Facebook, Instagram, Linkedin, Loader2 } from "lucide-react";
import { toast } from "sonner";

const PLATFORMS = [
  { id: "facebook", label: "Facebook", icon: <Facebook className="w-4 h-4 text-blue-600" /> },
  { id: "instagram", label: "Instagram", icon: <Instagram className="w-4 h-4 text-pink-600" /> },
  { id: "linkedin", label: "LinkedIn", icon: <Linkedin className="w-4 h-4 text-blue-700" /> },
];

const TONES = [
  { id: "friendly", label: "Friendly" },
  { id: "professional", label: "Professional" },
  { id: "fun", label: "Fun" },
  { id: "inspirational", label: "Inspirational" },
];

type FormData = {
  name: string;
  industry: string;
  tone: "friendly" | "professional" | "fun" | "inspirational";
  targetAudience: string;
  keywords: string;
  platforms: string[];
  postTime: string;
};

export default function BrandFormPage() {
  const [, setLocation] = useLocation();
  const [matchEdit, params] = useRoute("/brands/:id");
  const isEdit = matchEdit && params?.id !== "new";
  const brandId = isEdit ? Number(params?.id) : null;
  const queryClient = useQueryClient();

  const { data: brand } = useGetBrand(brandId!, {
    query: { enabled: !!brandId, queryKey: getGetBrandQueryKey(brandId!) },
  });
  const createBrand = useCreateBrand();
  const updateBrand = useUpdateBrand();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      industry: "",
      tone: "professional",
      targetAudience: "",
      keywords: "",
      platforms: [],
      postTime: "09:00",
    },
  });

  useEffect(() => {
    if (brand) {
      reset({
        name: brand.name,
        industry: brand.industry,
        tone: brand.tone as any,
        targetAudience: brand.targetAudience,
        keywords: brand.keywords,
        platforms: brand.platforms,
        postTime: brand.postTime,
      });
    }
  }, [brand, reset]);

  const selectedPlatforms = watch("platforms");

  async function onSubmit(data: FormData) {
    if (data.platforms.length === 0) {
      toast.error("Please select at least one platform");
      return;
    }

    if (isEdit && brandId) {
      updateBrand.mutate(
        { id: brandId, data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetBrandQueryKey(brandId) });
            toast.success("Brand updated successfully");
            setLocation("/brands");
          },
          onError: (err: any) => toast.error(err?.data?.error ?? "Failed to update brand"),
        }
      );
    } else {
      createBrand.mutate(
        { data },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
            toast.success("Brand created successfully");
            setLocation("/brands");
          },
          onError: (err: any) => toast.error(err?.data?.error ?? "Failed to create brand"),
        }
      );
    }
  }

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/brands" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{isEdit ? "Edit Brand" : "Create Brand"}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isEdit ? "Update your brand details" : "Set up a new brand for AI post generation"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground text-sm">Brand Details</h2>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Brand Name *</label>
              <input
                {...register("name", { required: "Brand name is required" })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="e.g. Acme Coffee Co."
              />
              {errors.name && <p className="text-destructive text-xs mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Industry *</label>
              <input
                {...register("industry", { required: "Industry is required" })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="e.g. Coffee & Cafes, Real Estate, Fitness"
              />
              {errors.industry && <p className="text-destructive text-xs mt-1">{errors.industry.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Tone of Voice *</label>
              <Controller
                name="tone"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2">
                    {TONES.map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => field.onChange(id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          field.value === id
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-foreground hover:bg-secondary"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Target Audience *</label>
              <input
                {...register("targetAudience", { required: "Target audience is required" })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="e.g. Small business owners aged 25-45"
              />
              {errors.targetAudience && <p className="text-destructive text-xs mt-1">{errors.targetAudience.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Keywords</label>
              <input
                {...register("keywords", { required: "Keywords are required" })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="e.g. coffee, sustainability, morning routine"
              />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated keywords to include in posts</p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground text-sm">Publishing Settings</h2>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Platforms *</label>
              <Controller
                name="platforms"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2">
                    {PLATFORMS.map(({ id, label, icon }) => {
                      const selected = field.value.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => {
                            if (selected) {
                              field.onChange(field.value.filter((p: string) => p !== id));
                            } else {
                              field.onChange([...field.value, id]);
                            }
                          }}
                          className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                            selected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-background text-foreground hover:bg-secondary"
                          }`}
                        >
                          {icon}
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              />
              {selectedPlatforms.length === 0 && <p className="text-xs text-muted-foreground mt-1">Select at least one platform</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Daily Post Time</label>
              <input
                type="time"
                {...register("postTime")}
                className="border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <p className="text-xs text-muted-foreground mt-1">When to publish scheduled posts (your local time)</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/brands" className="flex-1 text-center border border-border text-foreground font-medium px-4 py-2.5 rounded-lg hover:bg-secondary transition-colors text-sm">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || createBrand.isPending || updateBrand.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-60"
            >
              {(isSubmitting || createBrand.isPending || updateBrand.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {isEdit ? "Save Changes" : "Create Brand"}
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
