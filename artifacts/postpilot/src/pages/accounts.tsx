import Layout from "@/components/layout";
import { useState, useEffect } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  XCircle,
  Trash2,
  ExternalLink,
  Info,
  Loader2,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");

type SocialAccount = {
  id: number;
  platform: string;
  accountName: string;
  accountHandle: string | null;
  profilePictureUrl: string | null;
  isActive: boolean;
  createdAt: string;
};

const PLATFORMS = [
  {
    id: "facebook",
    label: "Facebook",
    color: "#1877F2",
    bgLight: "bg-blue-50",
    borderColor: "border-blue-100",
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#1877F2">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
    connectUrl: `${BASE_URL}/api/social-accounts/connect/facebook`,
    scopeHint: "Publish posts to your Facebook Pages",
    docsUrl: "https://developers.facebook.com/docs/facebook-login",
  },
  {
    id: "instagram",
    label: "Instagram",
    color: "#E1306C",
    bgLight: "bg-pink-50",
    borderColor: "border-pink-100",
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="url(#igGrad)">
        <defs>
          <linearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f09433" />
            <stop offset="25%" stopColor="#e6683c" />
            <stop offset="50%" stopColor="#dc2743" />
            <stop offset="75%" stopColor="#cc2366" />
            <stop offset="100%" stopColor="#bc1888" />
          </linearGradient>
        </defs>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
    connectUrl: `${BASE_URL}/api/social-accounts/connect/instagram`,
    scopeHint: "Publish to your Instagram Business account",
    docsUrl: "https://developers.facebook.com/docs/instagram-api",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    color: "#0A66C2",
    bgLight: "bg-sky-50",
    borderColor: "border-sky-100",
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#0A66C2">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
    connectUrl: `${BASE_URL}/api/social-accounts/connect/linkedin`,
    scopeHint: "Post to your LinkedIn profile and company pages",
    docsUrl: "https://learn.microsoft.com/en-us/linkedin/marketing/",
  },
  {
    id: "tiktok",
    label: "TikTok",
    color: "#000000",
    bgLight: "bg-gray-50",
    borderColor: "border-gray-100",
    icon: (
      <svg viewBox="0 0 24 24" className="w-7 h-7" fill="#000000">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.22 8.22 0 004.79 1.52V6.77a4.85 4.85 0 01-1.02-.08z" />
      </svg>
    ),
    connectUrl: `${BASE_URL}/api/social-accounts/connect/tiktok`,
    scopeHint: "Publish videos to your TikTok account",
    docsUrl: "https://developers.tiktok.com/",
  },
];

function useListSocialAccounts() {
  return useQuery<SocialAccount[]>({
    queryKey: ["social-accounts"],
    queryFn: async () => {
      const res = await fetch(`${BASE_URL}/api/social-accounts`);
      if (!res.ok) throw new Error("Failed to load accounts");
      return res.json();
    },
  });
}

function useDisconnectAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE_URL}/api/social-accounts/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-accounts"] });
      toast.success("Account disconnected");
    },
    onError: () => toast.error("Failed to disconnect account"),
  });
}

export default function AccountsPage() {
  const { data: connected = [], isLoading } = useListSocialAccounts();
  const disconnect = useDisconnectAccount();
  const { getToken } = useAuth();
  const [connectDialog, setConnectDialog] = useState<typeof PLATFORMS[0] | null>(null);
  const [disconnectId, setDisconnectId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleAuthorise = async (platform: typeof PLATFORMS[0]) => {
    setConnecting(true);
    setConnectError(null);
    try {
      const token = await getToken();
      const res = await fetch(`${BASE_URL}/api/social-accounts/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ platform: platform.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "not_configured") {
          setConnectError(`${platform.label} OAuth credentials are not yet configured on this server. Please contact your administrator to enable this integration.`);
        } else {
          setConnectError(data.error ?? "Something went wrong. Please try again.");
        }
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setConnectError("Network error. Please check your connection and try again.");
    } finally {
      setConnecting(false);
    }
  };

  const search = useSearch();
  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.get("connected") === "1") {
      toast.success("Account connected successfully!");
      window.history.replaceState({}, "", window.location.pathname);
    }
    const errorPlatform = params.get("platform");
    if (params.get("error") === "not_configured" && errorPlatform) {
      const label = PLATFORMS.find(p => p.id === errorPlatform)?.label ?? errorPlatform;
      toast.error(`${label} integration needs OAuth credentials. Contact your admin to configure it.`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [search]);

  const getConnected = (platformId: string) =>
    connected.filter(a => a.platform === platformId);

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Social Accounts</h1>
          <p className="text-muted-foreground mt-1">
            Connect your social profiles so PostPilot can publish content automatically.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
            <Loader2 className="w-5 h-5 animate-spin" />
            Loading accounts…
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {PLATFORMS.map(platform => {
              const accounts = getConnected(platform.id);
              const isConnected = accounts.length > 0;
              return (
                <div
                  key={platform.id}
                  className={cn(
                    "rounded-xl border bg-card p-5 flex flex-col gap-4",
                    isConnected ? platform.borderColor : "border-border"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0", platform.bgLight)}>
                      {platform.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground">{platform.label}</p>
                      <p className="text-xs text-muted-foreground">{platform.scopeHint}</p>
                    </div>
                    {isConnected ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                        <CheckCircle2 className="w-3 h-3" />
                        Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-full">
                        <XCircle className="w-3 h-3" />
                        Not connected
                      </span>
                    )}
                  </div>

                  {accounts.length > 0 && (
                    <div className="space-y-2">
                      {accounts.map(account => (
                        <div key={account.id} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                          {account.profilePictureUrl ? (
                            <img src={account.profilePictureUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-xs">
                              {account.accountName[0]?.toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{account.accountName}</p>
                            {account.accountHandle && (
                              <p className="text-xs text-muted-foreground truncate">@{account.accountHandle}</p>
                            )}
                          </div>
                          <button
                            onClick={() => setDisconnectId(account.id)}
                            className="p-1.5 rounded-md hover:bg-red-50 hover:text-red-600 text-muted-foreground transition-colors"
                            title="Disconnect"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant={isConnected ? "outline" : "default"}
                    size="sm"
                    className="w-full"
                    onClick={() => setConnectDialog(platform)}
                  >
                    {isConnected ? "Connect another account" : `Connect ${platform.label}`}
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 rounded-xl border border-border bg-secondary/40 p-5 flex gap-3">
          <Info className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">How auto-posting works</p>
            <p className="text-sm text-muted-foreground mt-1">
              Once connected, PostPilot will use your stored access tokens to publish generated
              posts directly to each platform at the schedule set in your Brand settings.
              Tokens are encrypted and never shared.
            </p>
          </div>
        </div>

        {connected.length === 0 && !isLoading && (
          <div className="mt-6 text-center py-6 text-muted-foreground text-sm flex flex-col items-center gap-2">
            <Users className="w-8 h-8 text-muted-foreground/40" />
            No accounts connected yet. Connect at least one platform above to enable auto-posting.
          </div>
        )}
      </div>

      {/* Connect dialog */}
      <Dialog open={!!connectDialog} onOpenChange={() => { setConnectDialog(null); setConnectError(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {connectDialog?.icon && (
                <span className="w-6 h-6">{connectDialog.icon}</span>
              )}
              Connect {connectDialog?.label}
            </DialogTitle>
            <DialogDescription>
              Authorise PostPilot to publish on your behalf.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {connectError ? (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 flex gap-2 text-sm text-red-700">
                <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{connectError}</span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Clicking <strong>Authorise</strong> will open {connectDialog?.label}'s login page.
                Sign in with the account you want to publish from, then grant the requested permissions.
              </p>
            )}
            <div className="rounded-lg bg-secondary/60 border border-border p-3 text-xs text-muted-foreground">
              <strong>Permissions requested:</strong> {connectDialog?.scopeHint}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                disabled={connecting}
                onClick={() => {
                  if (connectDialog) handleAuthorise(connectDialog);
                }}
              >
                {connecting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Connecting…</>
                ) : (
                  <><ExternalLink className="w-4 h-4 mr-2" />Authorise with {connectDialog?.label}</>
                )}
              </Button>
              <Button variant="outline" className="w-full" disabled={connecting} onClick={() => { setConnectDialog(null); setConnectError(null); }}>
                {connectError ? "Close" : "Cancel"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Need help?{" "}
              <a
                href={connectDialog?.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                {connectDialog?.label} developer docs
              </a>
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Disconnect confirm dialog */}
      <AlertDialog open={disconnectId !== null} onOpenChange={() => setDisconnectId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect account?</AlertDialogTitle>
            <AlertDialogDescription>
              This account will be removed. PostPilot will no longer be able to post to it.
              You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (disconnectId !== null) {
                  disconnect.mutate(disconnectId);
                  setDisconnectId(null);
                }
              }}
            >
              Disconnect
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
