import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useAuth } from "@clerk/react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { WorkspaceProvider } from "@/lib/workspaceContext";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Redirect, Router as WouterRouter } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { queryClient } from "./lib/queryClient";
import LandingPage from "@/pages/landing";
import DashboardPage from "@/pages/dashboard";
import BrandsPage from "@/pages/brands";
import BrandFormPage from "@/pages/brand-form";
import BrandDetailPage from "@/pages/brand-detail";
import GeneratePage from "@/pages/generate";
import PostsPage from "@/pages/posts";
import ApprovalPage from "@/pages/approval";
import BillingPage from "@/pages/billing";
import SettingsPage from "@/pages/settings";
import AccountsPage from "@/pages/accounts";
import CalendarPage from "@/pages/calendar";
import LibraryPage from "@/pages/library";
import AffiliatePage from "@/pages/affiliate";
import AdminPage from "@/pages/admin";
import TeamPage from "@/pages/team";
import InvitePage from "@/pages/invite";
import FeaturesPage from "@/pages/marketing/features";
import PricingPage from "@/pages/marketing/pricing";
import AffiliateLandingPage from "@/pages/marketing/affiliate";
import AboutPage from "@/pages/marketing/about";
import LegalPage from "@/pages/marketing/legal";
import NotFound from "@/pages/not-found";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(230, 100%, 60%)",
    colorForeground: "hsl(222, 47%, 11%)",
    colorMutedForeground: "hsl(215, 16%, 47%)",
    colorDanger: "hsl(0, 84%, 60%)",
    colorBackground: "hsl(0, 0%, 100%)",
    colorInput: "hsl(214, 32%, 91%)",
    colorInputForeground: "hsl(222, 47%, 11%)",
    colorNeutral: "hsl(214, 32%, 91%)",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-lg border border-border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-semibold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground",
    formFieldLabel: "text-foreground font-medium",
    footerActionLink: "text-primary",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-green-600",
    alertText: "text-foreground",
    logoBox: "",
    logoImage: "h-8",
    socialButtonsBlockButton: "border border-border bg-white hover:bg-secondary",
    formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
    formFieldInput: "bg-white border-border text-foreground",
    footerAction: "",
    dividerLine: "bg-border",
    alert: "bg-secondary border-border",
    otpCodeFieldInput: "border-border",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ApiClientAuthBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn) {
      setAuthTokenGetter(async () => {
        try {
          return (await getToken()) ?? null;
        } catch {
          return null;
        }
      });
    } else {
      setAuthTokenGetter(null);
    }
  }, [isLoaded, isSignedIn, getToken]);

  return null;
}

function AffiliateAttributionBridge() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;
    let cancelled = false;
    (async () => {
      const { getStoredReferralCode, hasAttributed, markAttributed } = await import(
        "./lib/affiliate-tracking"
      );
      if (hasAttributed(userId)) return;
      const code = getStoredReferralCode();
      if (!code) return;
      try {
        const token = await getToken();
        const res = await fetch(`${basePath}/api/affiliate/attribute-signup`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ code }),
        });
        if (!cancelled && res.ok) markAttributed(userId);
      } catch {
        // ignore — attribution is best effort and will retry on next load
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId, getToken]);

  return null;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl || undefined}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back to KonnectPilot",
            subtitle: "Sign in to your account",
          },
        },
        signUp: {
          start: {
            title: "Get started with KonnectPilot",
            subtitle: "Create your free account",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ApiClientAuthBridge />
        <AffiliateAttributionBridge />
        <ClerkQueryClientCacheInvalidator />
        <WorkspaceProvider>
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/features" component={FeaturesPage} />
          <Route path="/pricing" component={PricingPage} />
          <Route path="/affiliate-program" component={AffiliateLandingPage} />
          <Route path="/about" component={AboutPage} />
          <Route path="/legal/terms" component={() => <LegalPage slug="terms" />} />
          <Route path="/legal/privacy" component={() => <LegalPage slug="privacy" />} />
          <Route path="/legal/cookies" component={() => <LegalPage slug="cookies" />} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/dashboard" component={() => <ProtectedRoute component={DashboardPage} />} />
          <Route path="/calendar" component={() => <ProtectedRoute component={CalendarPage} />} />
          <Route path="/library" component={() => <ProtectedRoute component={LibraryPage} />} />
          <Route path="/affiliate" component={() => <ProtectedRoute component={AffiliatePage} />} />
          <Route path="/brands/new" component={() => <ProtectedRoute component={BrandFormPage} />} />
          <Route path="/brands/:id" component={() => <ProtectedRoute component={BrandDetailPage} />} />
          <Route path="/brands" component={() => <ProtectedRoute component={BrandsPage} />} />
          <Route path="/generate" component={() => <ProtectedRoute component={GeneratePage} />} />
          <Route path="/posts" component={() => <ProtectedRoute component={PostsPage} />} />
          <Route path="/approval" component={() => <ProtectedRoute component={ApprovalPage} />} />
          <Route path="/billing" component={() => <ProtectedRoute component={BillingPage} />} />
          <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
          <Route path="/accounts" component={() => <ProtectedRoute component={AccountsPage} />} />
          <Route path="/admin" component={() => <ProtectedRoute component={AdminPage} />} />
          <Route path="/team" component={() => <ProtectedRoute component={TeamPage} />} />
          <Route path="/invite/:token" component={InvitePage} />
          <Route component={NotFound} />
        </Switch>
        <Toaster />
        </WorkspaceProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
