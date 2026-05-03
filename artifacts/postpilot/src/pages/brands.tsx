import Layout from "@/components/layout";
import { Link } from "wouter";
import { useListBrands, useDeleteBrand, getListBrandsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Building2, ChevronRight, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";

export default function BrandsPage() {
  const { data: brands, isLoading } = useListBrands();
  const deleteBrand = useDeleteBrand();
  const queryClient = useQueryClient();

  async function handleDelete(e: React.MouseEvent, id: number, name: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`Delete brand "${name}"? This will also delete all associated posts and schedules.`)) return;
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
            <p className="text-sm text-muted-foreground mt-0.5">
              Each brand holds your identity, schedules, and posts in one place.
            </p>
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
              <Link
                key={brand.id}
                href={`/brands/${brand.id}`}
                className="bg-card border border-border rounded-xl p-5 hover:border-primary/30 hover:shadow-sm transition-all group block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-foreground text-sm truncate">{brand.name}</h3>
                      <p className="text-xs text-muted-foreground capitalize truncate">{brand.industry}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors flex-shrink-0 mt-1.5" />
                </div>

                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
                  <span className="capitalize bg-secondary px-2 py-0.5 rounded-full">{brand.tone}</span>
                </div>

                {brand.targetAudience && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                    {brand.targetAudience}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, brand.id, brand.name)}
                    className="text-xs font-medium text-muted-foreground hover:text-destructive flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
