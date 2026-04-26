import Layout from "@/components/layout";
import { Link } from "wouter";
import { useListBrands, useDeleteBrand, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, Pencil, Trash2, Facebook, Instagram, Linkedin, Zap } from "lucide-react";
import { FaTiktok } from "react-icons/fa";
import { toast } from "sonner";

function PlatformBadge({ platform }: { platform: string }) {
  const config: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    facebook: { icon: <Facebook className="w-3 h-3" />, label: "Facebook", cls: "bg-blue-50 text-blue-700" },
    instagram: { icon: <Instagram className="w-3 h-3" />, label: "Instagram", cls: "bg-pink-50 text-pink-700" },
    linkedin: { icon: <Linkedin className="w-3 h-3" />, label: "LinkedIn", cls: "bg-blue-50 text-blue-800" },
    tiktok: { icon: <FaTiktok className="w-3 h-3" />, label: "TikTok", cls: "bg-gray-100 text-gray-700" },
  };
  const c = config[platform];
  if (!c) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${c.cls}`}>
      {c.icon}
      {c.label}
    </span>
  );
}

export default function BrandsPage() {
  const { data: brands, isLoading } = useListBrands();
  const deleteBrand = useDeleteBrand();
  const queryClient = useQueryClient();

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete brand "${name}"? This will also delete all associated posts.`)) return;
    deleteBrand.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListBrandsQueryKey() });
        toast.success(`Brand "${name}" deleted`);
      },
      onError: () => toast.error("Failed to delete brand"),
    });
  }

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Brands</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your brands and their posting settings</p>
          </div>
          <Link href="/brands/new" className="flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-3 py-2 rounded-lg hover:bg-primary/90 transition-colors">
            <Plus className="w-4 h-4" />
            New Brand
          </Link>
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card border border-border rounded-xl p-5 animate-pulse">
                <div className="h-5 bg-muted rounded w-1/2 mb-3" />
                <div className="h-3 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : (brands?.length ?? 0) === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold text-foreground mb-2">No brands yet</h2>
            <p className="text-sm text-muted-foreground mb-4">Add your first brand to start generating AI-powered posts.</p>
            <Link href="/brands/new" className="inline-flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors">
              <Plus className="w-4 h-4" />
              Create your first brand
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {brands?.map((brand) => (
              <div key={brand.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 transition-colors group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">{brand.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize">{brand.industry}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full mt-1 ${brand.active ? "bg-green-500" : "bg-gray-300"}`} />
                </div>

                <div className="flex flex-wrap gap-1 mb-4">
                  {brand.platforms.map((p) => (
                    <PlatformBadge key={p} platform={p} />
                  ))}
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
                  <span className="capitalize bg-secondary px-2 py-0.5 rounded-full">{brand.tone}</span>
                  <span>·</span>
                  <span>Posts at {brand.postTime}</span>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/brands/${brand.id}`}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium border border-border px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(brand.id, brand.name)}
                    className="flex items-center justify-center gap-1.5 text-xs font-medium border border-border px-3 py-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
