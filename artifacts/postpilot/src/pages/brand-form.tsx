import Layout from "@/components/layout";
import { Link, useLocation } from "wouter";
import { useForm, Controller } from "react-hook-form";
import {
  useCreateBrand,
  getListBrandsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

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
};

export default function BrandFormPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createBrand = useCreateBrand();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      industry: "",
      tone: "professional",
      targetAudience: "",
      keywords: "",
    },
  });

  async function onSubmit(data: FormData) {
    createBrand.mutate(
      { data },
      {
        onSuccess: (brand: any) => {
          queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
          toast.success("Brand created — set up a posting schedule next");
          setLocation(brand?.id ? `/brands/${brand.id}` : "/brands");
        },
        onError: (err: any) => toast.error(err?.data?.error ?? "Failed to create brand"),
      }
    );
  }

  return (
    <Layout>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/brands" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Create Brand</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Set up your brand's identity. You'll add posting schedules on the next screen.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="bg-card border border-border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground text-sm">Brand Identity</h2>

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
              <label className="block text-sm font-medium text-foreground mb-1.5">Keywords *</label>
              <input
                {...register("keywords", { required: "Keywords are required" })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder="e.g. coffee, sustainability, morning routine"
              />
              <p className="text-xs text-muted-foreground mt-1">Comma-separated keywords AI will weave into posts</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Link href="/brands" className="flex-1 text-center border border-border text-foreground font-medium px-4 py-2.5 rounded-lg hover:bg-secondary transition-colors text-sm">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || createBrand.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground font-medium px-4 py-2.5 rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-60"
            >
              {(isSubmitting || createBrand.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              Create Brand
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
}
