import Layout from "@/components/layout";
import { useUser, useClerk } from "@clerk/react";
import { UserProfile } from "@clerk/react";
import { Settings2, LogOut } from "lucide-react";

export default function SettingsPage() {
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <Layout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage your account and preferences</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <UserProfile
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "!shadow-none !border-0 !rounded-none w-full",
                navbar: "border-r border-border",
                pageScrollBox: "p-6",
              },
            }}
          />
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold text-foreground mb-1">Sign Out</h2>
          <p className="text-sm text-muted-foreground mb-4">Sign out of your PostPilot account on this device.</p>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 text-sm font-medium border border-border px-4 py-2 rounded-lg hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>
    </Layout>
  );
}
