import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useAuth, Show } from "@clerk/react";
import { Loader2, Check, X as XIcon, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/lib/workspaceContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function InvitePage() {
  const [, params] = useRoute("/invite/:token");
  const token = params?.token;
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { refresh, switchWorkspace } = useWorkspace();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();

  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"accepted" | "declined" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(action: "accept" | "decline") {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const t = await getToken();
      const res = await fetch(`/api/invitations/${token}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(t ? { Authorization: `Bearer ${t}` } : {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed");
      setDone(action === "accept" ? "accepted" : "declined");
      if (action === "accept") {
        qc.clear();
        await refresh();
        if (data.workspaceId) await switchWorkspace(data.workspaceId);
        toast.success("Joined workspace");
        setTimeout(() => setLocation("/dashboard"), 600);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (token) sessionStorage.setItem("pendingInviteToken", token);
  }, [token]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md border border-border rounded-2xl bg-card p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground mb-2">Workspace invitation</h1>

        <Show when="signed-out">
          <p className="text-sm text-muted-foreground mb-4">
            Sign in or create an account with the email this invite was sent to. We'll add you automatically.
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={() => setLocation("/sign-in")}>Sign in</Button>
            <Button variant="outline" onClick={() => setLocation("/sign-up")}>Create account</Button>
          </div>
        </Show>

        <Show when="signed-in">
          {!done && (
            <>
              <p className="text-sm text-muted-foreground mb-5">
                You've been invited to join a team workspace on KonnectPilot.
              </p>
              {error && <div className="text-xs text-destructive mb-3">{error}</div>}
              <div className="flex gap-2 justify-center">
                <Button onClick={() => call("accept")} disabled={busy || !isLoaded || !isSignedIn}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                  Accept
                </Button>
                <Button variant="outline" onClick={() => call("decline")} disabled={busy}>
                  <XIcon className="w-4 h-4 mr-2" /> Decline
                </Button>
              </div>
            </>
          )}
          {done === "accepted" && (
            <p className="text-sm text-foreground">Joined! Redirecting…</p>
          )}
          {done === "declined" && (
            <>
              <p className="text-sm text-foreground mb-3">Invitation declined.</p>
              <Button variant="outline" onClick={() => setLocation("/dashboard")}>Go to dashboard</Button>
            </>
          )}
        </Show>
      </div>
    </div>
  );
}

void basePath;
