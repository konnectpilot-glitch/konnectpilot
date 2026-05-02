import MarketingShell from "@/components/marketing-shell";

const DOCS: Record<string, { title: string; updated: string; sections: { h: string; p: string }[] }> = {
  terms: {
    title: "Terms of Service",
    updated: "May 2026",
    sections: [
      { h: "1. Acceptance of terms", p: "By creating a KonnectPilot account or using the service, you agree to these terms. If you don't agree, don't use the service." },
      { h: "2. Your account", p: "You're responsible for safeguarding your login credentials and for any activity under your account. Notify us immediately of any unauthorized use." },
      { h: "3. Subscriptions and trials", p: "All paid plans start with a 7-day free trial. You authorize us to charge your payment method at the end of the trial unless you cancel. You can cancel anytime from the billing portal." },
      { h: "4. Acceptable use", p: "You agree not to use the service to publish content that violates the policies of any connected social platform, applicable law, or third-party rights." },
      { h: "5. AI-generated content", p: "AI captions and images are generated based on your prompts. You're responsible for reviewing AI output before publishing and for ensuring it complies with all applicable laws and platform rules." },
      { h: "6. Termination", p: "We may suspend or terminate accounts that violate these terms. You may cancel and request data export at any time." },
      { h: "7. Limitation of liability", p: "The service is provided 'as is'. To the fullest extent permitted by law, KonnectPilot is not liable for indirect, incidental, or consequential damages." },
      { h: "8. Changes", p: "We may update these terms periodically. Material changes will be communicated by email at least 30 days in advance." },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "May 2026",
    sections: [
      { h: "1. What we collect", p: "Account info (name, email), workspace + content data (brands, posts, media), social tokens you authorize, billing info via Stripe, and usage analytics." },
      { h: "2. How we use it", p: "To run the service, publish your scheduled content, generate AI assets, send essential emails, and improve the product. We never sell your data." },
      { h: "3. Sharing", p: "We share data only with subprocessors that power the service (e.g. payment processor, AI providers, email provider, hosting). All bound by data-protection terms." },
      { h: "4. Security", p: "Social tokens are encrypted at rest. We enforce per-workspace isolation and rate limits. Payments are processed by Stripe and never touch our servers in raw form." },
      { h: "5. Your rights", p: "You can export your data or delete your account from the in-app Settings. After account deletion we retain data for 30 days for recovery, then it's permanently removed." },
      { h: "6. Cookies", p: "We use essential cookies for authentication and a small set of analytics cookies to understand product usage. See our Cookie Policy for details." },
      { h: "7. Contact", p: "Questions about your data? Email privacy@konnectpilot.com." },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    updated: "May 2026",
    sections: [
      { h: "1. What are cookies?", p: "Small text files stored on your device that help us recognize your session and improve your experience." },
      { h: "2. Essential cookies", p: "Used for authentication, session management, and CSRF protection. The product won't work without these." },
      { h: "3. Analytics cookies", p: "Help us understand which features are used so we can improve the product. Anonymized and aggregated." },
      { h: "4. Managing cookies", p: "You can disable cookies in your browser settings, but parts of the product may stop working. We don't use third-party advertising cookies." },
    ],
  },
};

export default function LegalPage({ slug }: { slug: string }) {
  const doc = DOCS[slug];
  if (!doc) {
    return (
      <MarketingShell>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-20 text-center">
          <h1 className="text-3xl font-bold text-foreground">Document not found</h1>
        </div>
      </MarketingShell>
    );
  }

  return (
    <MarketingShell>
      <article className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 pb-20">
        <p className="text-sm text-muted-foreground mb-2">Last updated {doc.updated}</p>
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-8">{doc.title}</h1>
        <div className="space-y-6">
          {doc.sections.map((s) => (
            <section key={s.h}>
              <h2 className="text-lg font-semibold text-foreground mb-2">{s.h}</h2>
              <p className="text-muted-foreground leading-relaxed">{s.p}</p>
            </section>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-12 italic">
          This is a plain-language summary suitable for the MVP. Consult a lawyer for the final, jurisdiction-specific version before launching publicly.
        </p>
      </article>
    </MarketingShell>
  );
}
