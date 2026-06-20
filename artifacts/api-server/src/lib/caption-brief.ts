// Caption prompt builder
// ──────────────────────
// Shared between routes/generate.ts (on-demand) and scheduler.ts (auto).
// The job: produce a single prompt that gets Claude to write a caption that
// (a) sounds like the BRAND, not a generic AI; (b) opens with a real hook;
// (c) doesn't leak AI tells; (d) hits platform-appropriate length + format.
//
// The single biggest lever is the few-shot example posts from the brand —
// when the user pastes 2-3 of their real posts, Claude writes captions that
// land much closer to "theirs". Voice description is second-best signal.
//
// Anti-AI-tell block is critical. Modern Claude can write surprisingly human
// copy, but defaults to a recognizable "thrilled to share / delve into /
// navigate this landscape" register unless explicitly told not to.

export type Platform = "instagram" | "facebook" | "linkedin";

export interface CaptionBriefInput {
  brand: {
    name: string;
    industry: string;
    targetAudience: string;
    keywords?: string | null;
    tone?: string | null;
    voiceDescription?: string | null;
    examplePosts?: string | null;
    doDontRules?: string | null;
    platformOverrides?: Record<string, string> | null;
    websiteUrl?: string | null;
  };
  platform: Platform | string;
  topic?: string | null;
  /** Content pillar for THIS post (educate, spotlight, etc.) */
  pillar?: string | null;
  /** Soft guidance string from pillar selection (already rendered). */
  pillarGuidance?: string | null;
  /** Brand-memory + performance-memory blocks, already prefixed. */
  memoryContext?: string;
}

// Platform-specific structural guidance. Each has:
//   - target length (words)
//   - opening hook expectation
//   - structural pattern
//   - hashtag policy
// Numbers are calibrated from actual best-performing ecommerce DTC posts.
const PLATFORM_GUIDANCE: Record<string, string> = {
  instagram: `INSTAGRAM — target 80-150 words.
- OPEN with a hook (see hook menu below). The hook is the first sentence — if it doesn't earn the "more" tap, the rest never gets read.
- After the hook, 2-4 short paragraphs. Line breaks between paragraphs (use blank line) — Instagram collapses on mobile, so dense walls of text get ignored.
- End with a soft CTA or open question — NOT a hard "buy now". Examples: "Which one's your go-to?", "Drop a 🍪 if you've been there", "Save this for next week".
- 3-6 RELEVANT hashtags at the very bottom on their own line(s). Mix one or two big-volume tags with niche/branded ones.
- Emoji use: 0-3 total, used as visual punctuation, never as bullet markers.`,
  facebook: `FACEBOOK — target 50-100 words. Shorter than IG.
- OPEN with a question, a contrarian observation, or a story-tease.
- One short paragraph, MAYBE two. Facebook's algorithm rewards comments — every post should end with a question that's easy to answer (yes/no, this-or-that, one-word).
- NO hashtags (Facebook deprioritizes them).
- 0-2 emoji, used sparingly.`,
  linkedin: `LINKEDIN — target 150-250 words.
- OPEN with either: (a) a contrarian one-liner, (b) a personal-anecdote one-liner, or (c) a stat/result hook. The first 2-3 lines are what shows before "...see more" — they have to earn the click.
- Use SHORT lines, each on its own line, with blank lines between (LinkedIn-style cadence). Avoid Instagram-style paragraphs.
- Body: a specific story, observation, or insight — no fluff. Concrete > abstract.
- End with a soft question or takeaway. NOT "thoughts?".
- 0-3 hashtags at the end on a single line.
- Emoji: 0-1, optional.`,
};

const HOOK_MENU = `HOOK ARCHETYPES — pick the one that fits, do NOT do "ready to take your brand to the next level":
1. CONTRARIAN: state something counter-intuitive ("Most coffee shops measure beans by weight. The ones I love measure by feel.")
2. STAT/RESULT: lead with a specific number ("We tested 14 different cup sizes. The 8oz won.")
3. STORY-TEASE: drop into the middle of a moment ("My customer texted me at 11pm asking if we were open.")
4. OBSERVATION: a sharp truth about your audience ("If you're sourcing your own coffee, you've stopped trusting cafes.")
5. QUESTION-HOOK: a question your reader has actually asked ("Why does pour-over taste different at home?")
6. LIST-TEASE: number a list and tease the contents ("Three things every new barista gets wrong.")`;

// Anti-AI-tells — every modern AI defaults to this register. We explicitly
// forbid each phrase by name because hand-wavy instructions like "be human"
// don't work; named bans do.
const ANTI_TELLS = `STRICT — NEVER USE THESE PHRASES OR PATTERNS:
- "I'm thrilled / excited / honored / proud to share"
- "I appreciate"
- "delve into", "delve deeper", "let's delve"
- "navigate" / "navigating this landscape"
- "in today's fast-paced world", "in today's digital age", "in today's [anything] landscape"
- "ever-evolving", "ever-changing"
- "leverage" (use "use"), "elevate" (use "lift" or just say what you mean), "comprehensive" (use "full" or remove)
- "It's no secret that…", "Let's dive in", "Let's unpack"
- "Ready to take your [X] to the next level?" — every rhetorical "Ready to…?" opener
- "from [A] to [B], we've got you covered"
- Three-word power triplets ("passion, purpose, and grit")
- Em-dashes (—). Use commas or periods instead. This is the single clearest AI tell.
- Starting paragraphs with "Plus,…" or "And here's the thing,"
- Closing with "thoughts?" or "what do you think?"
- Emojis used as bullet-list markers (✨ Quality. ✨ Care. ✨ Craft.)
- Hashtag salad with vague tags like #motivation #inspiration #success
- "Imagine if…"
- "Here's the truth:" followed by an obvious statement`;

const PILLAR_HINTS: Record<string, string> = {
  educate: "Teach one concrete thing the reader can use today. Avoid 'top 5 tips' framing — go specific.",
  spotlight: "Lead with the product/service in action, not its name. Show what it FEELS like to use, not its features.",
  reviews: "Lead with the customer's words or a moment from their story. The brand's voice is the FRAME, not the lead.",
  bts: "Show one specific thing about how the work happens. A name, a tool, a step, a number. Avoid generic 'we work hard'.",
  promo: "Direct, low-friction. State the offer clearly, one reason it's worth taking, and a clean CTA. No hard-sell adjectives.",
};

/**
 * Build the comprehensive caption prompt. Returns the full prompt string to
 * send to generateClaudeText. The output of Claude should be the caption
 * itself — no preamble, no explanation.
 */
export function buildCaptionBrief(input: CaptionBriefInput): string {
  // Single-caption mode — delegates to the shared instruction builder.
  // Variant mode lives in buildCaptionVariantsBrief below.
  return baseInstructions(input);
}

/**
 * Variant mode: ask Claude for N distinct captions in different hook
 * archetypes (story / contrarian / stat) so the user gets real choice.
 * Returns the full prompt string that asks for a JSON array.
 */
export function buildCaptionVariantsBrief(input: CaptionBriefInput, count: number): string {
  const base = baseInstructions(input);
  const variantInstruction = `\n\n>>> VARIANT MODE: write ${count} DISTINCT captions, each using a different hook archetype from the menu above. Each must be a complete, ready-to-paste caption (not just a hook line) — full body, end-of-post CTA/question, and hashtags appropriate to the platform.

Return ONLY a JSON array of ${count} strings, no prose around the array:
[
  "<full caption 1 — uses one hook archetype>",
  "<full caption 2 — uses a different hook archetype>",
  "<full caption 3 — uses yet a different hook archetype>"
]

Do NOT prefix the array with anything. Do NOT label which hook archetype each one uses. The strings are the raw captions only.`;

  // Strip the trailing single-output instruction line from `base` and
  // replace it with the variant instruction.
  const baseTrimmed = base.replace(
    /\n*Write the post\.[\s\S]*$/,
    "",
  );
  return baseTrimmed + variantInstruction;
}

function baseInstructions(input: CaptionBriefInput): string {
  const { brand, platform, topic, pillar, pillarGuidance, memoryContext } = input;

  const platformGuide = PLATFORM_GUIDANCE[platform as string] ?? PLATFORM_GUIDANCE.instagram;

  const examplesBlock = brand.examplePosts
    ? `\n🎯 THE BRAND'S OWN POSTS (highest priority — match this voice exactly):\n---\n${brand.examplePosts.slice(0, 2000)}\n---\nNotice the brand's actual sentence rhythm, length, punctuation, and openings. Imitate THAT, not generic best-practice copywriting.\n`
    : "";

  const voiceBlock = brand.voiceDescription
    ? `BRAND VOICE (in their own words): ${brand.voiceDescription}`
    : `Tone of voice: ${brand.tone ?? "friendly"} (this is a weak signal — lean on platform + audience cues)`;

  const rulesBlock = brand.doDontRules
    ? `\nBRAND-SPECIFIC RULES (honor these always):\n${brand.doDontRules}\n`
    : "";

  const platformOverride = (brand.platformOverrides as any)?.[platform];
  const platformToneBlock = platformOverride
    ? `\nPLATFORM TONE OVERRIDE for ${platform}: ${platformOverride}\n`
    : "";

  const pillarBlock = pillar
    ? `\nCONTENT PILLAR for this post: ${pillar}${pillarGuidance ? ` — ${pillarGuidance}` : ""}\n${PILLAR_HINTS[pillar] ? `Tip: ${PILLAR_HINTS[pillar]}` : ""}\n`
    : "";

  const topicLine = topic
    ? `Today's topic: ${topic}`
    : "Choose a relevant moment from the brand's industry + keywords. Be specific — pick ONE thing to say, not 'general brand vibes'.";

  const websiteBlock = brand.websiteUrl
    ? `Brand website (only mention if it fits naturally): ${brand.websiteUrl}`
    : "";

  return `You are a copywriter for ${brand.name}, a ${brand.industry} business serving ${brand.targetAudience}.
${websiteBlock}

${voiceBlock}
${examplesBlock}${rulesBlock}${platformToneBlock}${pillarBlock}

${platformGuide}

${HOOK_MENU}

${ANTI_TELLS}

KEYWORDS to weave in (where natural — do NOT keyword-stuff): ${brand.keywords ?? "(none — go on industry/audience instinct)"}

${topicLine}
${memoryContext ?? ""}

Write the post. Output ONLY the post text. No preamble like "Here's the post:". No labels. No quotes around it. Just the caption itself, ready to paste.`;
}
