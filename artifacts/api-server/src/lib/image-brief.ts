// Image-brief enhancer
// ────────────────────
// The single biggest lever on AI image quality is the prompt. Generic prompts
// like "professional social media image for our brand" produce generic AI
// slop because the model has to guess everything — subject, lighting, lens,
// composition, mood. Detailed prompts produce professional output because
// the model has explicit direction on every variable.
//
// We solve this with a two-stage pipeline:
//   1. Claude writes a detailed photography brief from brand + topic +
//      platform — like a professional creative director writing for a shoot.
//   2. That brief goes to Nano Banana (Gemini 2.5 Flash Image) for rendering.
//
// The brief follows commercial-photography conventions: specific subject,
// camera/lens, lighting, composition, mood, color palette referencing brand
// colors, and explicit anti-AI-slop negative cues.

import { generateClaudeText } from "./ai-providers";

export type ImageStyle =
  | "auto"
  | "scroll_stopper"
  | "product_hero"
  | "lifestyle"
  | "editorial"
  | "minimalist_studio"
  | "documentary"
  | "flat_lay";

export interface ImageBriefInput {
  brand: {
    name: string;
    industry: string;
    targetAudience: string;
    voiceDescription?: string | null;
    tone?: string | null;
    keywords?: string | null;
    brandColorPrimary?: string | null;
    brandColorSecondary?: string | null;
    websiteUrl?: string | null;
  };
  topic?: string | null;
  platform?: string | null;
  postContent?: string | null;
  /** True if a reference logo image will be attached to the gen call. */
  hasLogoReference?: boolean;
  /** Optional style hint from the user. "auto" lets Claude pick. */
  style?: ImageStyle;
}

const STYLE_DIRECTIVES: Record<Exclude<ImageStyle, "auto">, string> = {
  scroll_stopper: "This image's ONLY job is to stop a thumb mid-scroll. Pick whichever of these reads strongest for the brand: (a) a human face filling a good part of the frame with a clear, genuine emotion (delight, surprise, focus) and eye contact toward or just past the camera; or (b) the actual product as a bold close-up hero with one high-contrast color pop. High contrast, one dominant focal point, generous clean space in the TOP THIRD or BOTTOM THIRD where a text hook will be overlaid later. Slightly raw and native — like a real phone photo a creator posted, NOT a polished corporate stock photo. Bold, punchy, impossible to scroll past.",
  product_hero: "Subject MUST be the product itself, centered and hero-shot. Clean controlled lighting (softbox at 45° or natural window), shallow depth of field, considered surface styling, minimal background distraction. Premium product photography style.",
  lifestyle: "Subject MUST be a person (or hands) naturally interacting with the brand or product in their environment. Candid moment, natural light, authentic styling — no posed-stock-photo feel. Lifestyle commercial photography style.",
  editorial: "Subject is the brand idea, composed like a magazine cover — strong negative space, deliberate styling, considered color story. Editorial commercial photography style.",
  minimalist_studio: "Single subject on a clean studio backdrop (off-white, deep neutral, or branded color). Minimal styling, controlled lighting, generous negative space. Minimalist studio photography style.",
  documentary: "Candid, unposed real-life moment in an authentic environment. Slightly imperfect framing, natural light only, captured-not-set-up feel. Documentary photography style.",
  flat_lay: "Overhead top-down shot of objects arranged on a surface (table, fabric, paper). Considered knolling, organic styling, soft diffused overhead light. Flat-lay editorial style.",
};

/**
 * Sensible aspect-ratio hints per platform. Most ecommerce social uses 1:1
 * (square) because it crops cleanly into feed grids. LinkedIn benefits from
 * 1.91:1 for in-feed link-card-style posts but 1:1 still works.
 */
function aspectHint(platform: string | null | undefined): string {
  switch (platform) {
    case "instagram":
      return "1:1 square aspect ratio (1080×1080), composed for Instagram's feed crop";
    case "facebook":
      return "1:1 square or 4:5 portrait aspect ratio, composed for Facebook feed";
    case "linkedin":
      return "1.91:1 landscape aspect ratio (1200×628) or 1:1, composed for LinkedIn feed";
    default:
      return "1:1 square aspect ratio";
  }
}

/**
 * Industry-aware visual archetypes. Helps Claude lean into a *specific*
 * commercial-photography style rather than "social media generic". When we
 * detect an industry we know, we hint the typical commercial look. When we
 * don't, we let Claude choose.
 */
const INDUSTRY_HINTS: Array<{ match: RegExp; archetype: string }> = [
  { match: /\b(coffee|cafe|espresso|roaster|barista)\b/i, archetype: "specialty-coffee editorial — close-up cups, steam, wood textures, soft window light, warm amber-cream palette" },
  { match: /\b(food|restaurant|recipe|cook|bakery|dessert)\b/i, archetype: "food editorial — overhead and 45° hero angles, natural light, organic shadows, plated styling, knolling-adjacent compositions" },
  { match: /\b(fitness|gym|trainer|yoga|workout|wellness)\b/i, archetype: "athletic lifestyle — high-contrast lighting, sweat-on-skin texture, movement blur or freeze-frame, environmental gym/outdoor settings" },
  { match: /\b(beauty|skin|cosmetic|makeup|skincare|spa)\b/i, archetype: "beauty editorial — soft diffused light, glossy product hero shots OR clean-skin model close-ups, neutral backdrops, minimal styling" },
  { match: /\b(fashion|apparel|cloth|wear|outfit|brand)\b/i, archetype: "fashion editorial — on-model lifestyle or flat-lay product shots, natural window light, considered styling, magazine-cover composition" },
  { match: /\b(travel|hotel|destination|tour|adventure)\b/i, archetype: "travel editorial — wide environmental shots, golden hour, person small in frame, vista-forward composition" },
  { match: /\b(real ?estate|home|property|interior|architect)\b/i, archetype: "real-estate editorial — wide-angle interior shots, evenly lit rooms, dusk exterior shots with warm interior glow, considered staging" },
  { match: /\b(saas|software|tech|ai|api|startup|app)\b/i, archetype: "B2B SaaS editorial — clean studio product shots of UI mockups on devices, OR human-centered office candids with shallow depth of field, neutral palette with brand accent" },
  { match: /\b(ecommerce|shopify|dtc|online ?store|drop ?ship)\b/i, archetype: "DTC ecommerce hero — product-first lifestyle, soft natural light, considered surface styling, brand-aligned color story" },
  { match: /\b(jewelry|watch|luxury|premium)\b/i, archetype: "luxury product editorial — macro close-ups, controlled studio lighting, hero against dark or velvet backdrop, high-end finish" },
  { match: /\b(pet|dog|cat|animal)\b/i, archetype: "pet lifestyle — candid moments at floor-level, soft natural light, fur texture detail, warm domestic settings" },
  { match: /\b(kids|baby|child|toy|parent)\b/i, archetype: "family lifestyle — candid joy, soft window light, warm tones, off-the-shoulder framing" },
  { match: /\b(book|education|course|learn|training|school)\b/i, archetype: "editorial education — books / laptops on warm desk surfaces, soft window light, hands-in-frame, organic clutter that reads 'real work happens here'" },
];

function archetypeFor(industry: string, fallback: string): string {
  for (const { match, archetype } of INDUSTRY_HINTS) {
    if (match.test(industry)) return archetype;
  }
  return fallback;
}

/**
 * Generate a professional image brief using Claude.
 *
 * Returns a single-paragraph prompt optimized for Gemini Flash Image.
 * Throws if Claude is misconfigured; callers should fall back to a simpler
 * prompt rather than crashing.
 */
/**
 * Generate N distinct image briefs in a SINGLE Claude call. Used by the
 * variants flow on /generate/image — each brief takes a different angle
 * (e.g. close-up product, wider lifestyle, top-down flat-lay) so the
 * resulting images are meaningfully different, not subtle re-rolls of the
 * same composition.
 *
 * Returns an array of N briefs. If Claude returns fewer or malformed JSON,
 * we top-up with the single-brief fallback so the caller always gets `count`
 * usable strings.
 */
export async function buildVariantImageBriefs(
  input: ImageBriefInput,
  count: number,
): Promise<string[]> {
  if (count <= 1) {
    return [await buildProfessionalImageBrief(input)];
  }

  const { brand, topic, platform, postContent, hasLogoReference } = input;
  const style: ImageStyle = input.style ?? "auto";

  const colorBlock = brand.brandColorPrimary
    ? `Primary ${brand.brandColorPrimary}${brand.brandColorSecondary ? `, secondary ${brand.brandColorSecondary}` : ""}.`
    : "no fixed palette";
  const voiceSignal = brand.voiceDescription ?? brand.tone ?? "";

  const postExcerpt = postContent
    ? `\nCaption this image will run with:\n"""\n${postContent.slice(0, 400)}\n"""`
    : "";

  const meta = `You are a creative director. Produce ${count} DISTINCT image-generation briefs for the same brand + topic. Each brief should take a meaningfully different visual angle so the user has real choices — not three re-rolls of the same composition.

THE #1 RULE — EVERY BRIEF MUST STOP THE SCROLL
Calm, generic "corporate stock" photos get skipped. Each brief must produce an image that arrests a thumb mid-scroll: lead with a HUMAN FACE showing genuine emotion + near-eye-contact, OR the ACTUAL PRODUCT as a bold close-up hero, plus ONE high-contrast color pop and a slightly raw native creator-shot feel (not glossy AI-perfect stock). Avoid people-from-behind, empty "office vibes" desks, anything that looks like a stock library result. Leave clean uncluttered space in the TOP or BOTTOM third — a bold text hook gets overlaid there later.

BRAND
- ${brand.name} — ${brand.industry}
- Audience: ${brand.targetAudience}
${voiceSignal ? `- Voice: ${voiceSignal}` : ""}
- Colors: ${colorBlock}

POST
- Platform: ${platform ?? "social"}
- Topic: ${topic ?? "evergreen brand-defining moment"}
${postExcerpt}

CONSTRAINTS
- Each brief is ONE flowing paragraph, in the same format as the single-brief path: specific subject, camera/lens, lighting, composition, color palette, style anchor, aspect ratio hint, anti-AI-slop negative cues.
- The ${count} briefs MUST differ in at least 2 of: subject framing (close-up vs wide vs overhead), lighting setup (window vs golden hour vs studio), and overall mood (warm vs minimalist vs documentary).
- All briefs end with: "photorealistic, shot on a phone camera, real natural skin texture with pores, candid and unretouched, no text overlays, no watermarks, no warped hands, no extra fingers, no plastic or waxy skin, no over-smoothed airbrushed look, no flawless model face, no glossy stock-photo lighting, no AI artifacts, no logos in the image."
${style !== "auto" ? `- All variants MUST use the user's requested style: ${style}. Vary the OTHER dimensions (lighting / framing / mood).` : "- Variants can use different photography styles (product hero, lifestyle, editorial, etc.) — that's part of giving real choice."}
${hasLogoReference ? "- A logo reference image will be attached — DO NOT render the logo in the output; the brand's color treatment should appear in the scene naturally." : ""}

Return ONLY a JSON array of ${count} strings, no prose around it:
[
  "brief 1...",
  "brief 2...",
  "brief 3..."
]`;

  try {
    const result = await generateClaudeText(meta, { maxTokens: 1400 });
    let raw = result.content.trim();
    const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) raw = fence[1].trim();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    const briefs = parsed
      .filter((s) => typeof s === "string" && s.trim().length > 30)
      .map((s) => (s as string).trim());
    // Top up with single-shot briefs if Claude returned fewer than asked.
    while (briefs.length < count) {
      try {
        briefs.push(await buildProfessionalImageBrief(input));
      } catch {
        break;
      }
    }
    return briefs.slice(0, count);
  } catch (err) {
    // Parsing or AI failure — fall back to N independent single-brief calls
    // so the user still gets variants, just slower.
    const briefs: string[] = [];
    for (let i = 0; i < count; i++) {
      try {
        briefs.push(await buildProfessionalImageBrief(input));
      } catch {
        // skip
      }
    }
    return briefs;
  }
}

export async function buildProfessionalImageBrief(input: ImageBriefInput): Promise<string> {
  const { brand, topic, platform, postContent, hasLogoReference } = input;
  const style: ImageStyle = input.style ?? "auto";
  const styleBlock =
    style !== "auto" && style in STYLE_DIRECTIVES
      ? `\nREQUESTED STYLE — you MUST follow this:\n${STYLE_DIRECTIVES[style as Exclude<ImageStyle, "auto">]}\n`
      : "";

  // Color palette signal — explicit hex codes are interpretable by Gemini and
  // produce more consistent brand colors than vague terms like "warm tones".
  const colorBlock = brand.brandColorPrimary
    ? `Brand color palette: primary ${brand.brandColorPrimary}${brand.brandColorSecondary ? `, secondary ${brand.brandColorSecondary}` : ""}. These should appear naturally in the scene (product, background, fabric, signage) — not as overlays.`
    : "No fixed brand color palette — pick colors that fit the brand's industry and voice.";

  // Voice signal — feeds the mood/aesthetic decision. We collapse the raw
  // voice into a mood hint Claude can use.
  const voiceSignal = brand.voiceDescription
    ? `Voice / mood reference: ${brand.voiceDescription}`
    : brand.tone
    ? `Tone reference: ${brand.tone}`
    : "";

  const archetype = archetypeFor(brand.industry, "scroll-stopping DTC ecommerce hero — product-first, bold focal point, one high-contrast color pop, native-feeling not stocky");

  const postExcerpt = postContent
    ? `\nThe image will run alongside this caption (use it to inform the visual concept, but do NOT embed the text in the image):\n"""\n${postContent.slice(0, 400)}\n"""`
    : "";

  const logoNote = hasLogoReference
    ? "A reference image of the brand's logo will be provided — incorporate the logo's color treatment and feel, but do NOT directly render the logo or text in the output."
    : "";

  const meta = `You are a creative director writing image-generation briefs for a high-end ecommerce brand. Your job: produce ONE detailed paragraph that another AI (Gemini 2.5 Flash Image) will render as a photograph.

THE #1 RULE — THE IMAGE MUST STOP THE SCROLL
A beautiful, calm, generic "corporate stock" photo does NOT make anyone stop scrolling — it gets skipped. Your brief must produce an image that arrests a thumb mid-scroll in under half a second. The levers that actually do this, in priority order: (1) a HUMAN FACE with a genuine, readable EMOTION and near-eye-contact; (2) the ACTUAL PRODUCT as a bold close-up hero; (3) ONE high-contrast color pop / strong focal point; (4) a slightly RAW, native, creator-shot feel rather than glossy AI-perfect stock. Avoid: people seen from behind or side with no emotion, empty "office vibes" desks, anything that looks like a stock-photo library result. Leave clean, uncluttered space in the TOP THIRD or BOTTOM THIRD of the frame — a bold text hook will be overlaid there afterward, so do not fill the whole frame edge-to-edge with busy detail.

THE #2 RULE — IT MUST NOT LOOK AI-GENERATED
The most common failure is an image that screams "AI": plastic/waxy skin, flawless symmetrical model faces, glossy over-retouched lighting, an unnaturally tidy scene. People recognise and skip these instantly. Fight it HARD:
- Describe a REAL, ordinary-looking person (not a model) — natural skin with visible texture, pores, faint blemishes or freckles, flyaway hair, a real candid expression. NEVER "flawless", "perfect", "beautiful model".
- Specify it was shot like a real phone photo: "shot on an iPhone", slightly imperfect framing, mild sensor grain, natural unretouched lighting, a touch of real-world clutter or imperfection in the scene.
- IMPORTANT: AI renders OBJECTS and PRODUCTS far more convincingly than human faces. When the concept allows, prefer a product close-up, hands-on-product, flat-lay, or unboxing shot over a full face — these reach photoreal far more reliably. Only use a prominent human face when emotion is essential to the hook.

THE BRAND
- Name: ${brand.name}
- Industry: ${brand.industry}
- Audience: ${brand.targetAudience}
${voiceSignal ? `- ${voiceSignal}` : ""}
${brand.websiteUrl ? `- Website: ${brand.websiteUrl}` : ""}

THIS POST
- Platform: ${platform ?? "social"}
- Topic: ${topic ?? "a versatile evergreen image that fits this brand's content mix"}
${postExcerpt}

VISUAL ARCHETYPE FOR THIS INDUSTRY
${archetype}
${styleBlock}

COLOR + LOGO
${colorBlock}
${logoNote}

YOUR OUTPUT — A SINGLE PARAGRAPH, IN ONE FLOWING SENTENCE OR TWO MAX

Include every one of these in order:
1. Specific subject (a person, a product, a scene — NOT "an image" or "a concept"). Be concrete.
2. Camera + lens / framing (e.g. "shot on 50mm f/1.8, shallow depth of field", "macro lens close-up", "wide environmental shot")
3. Lighting (specific, e.g. "soft window light from camera-left", "golden hour backlight", "studio softbox at 45°")
4. Composition (rule of thirds with subject in left third, negative space top-right, low angle, etc.)
5. Color palette / mood
6. Style anchor — choose ONE: "editorial commercial photography", "lifestyle commercial photography", "premium product photography", "documentary candid", "minimalist studio"
7. ${aspectHint(platform)}
8. Anti-AI-slop negative cues — append: "photorealistic, shot on a phone camera, real natural skin texture with pores, candid and unretouched, no text overlays, no watermarks, no warped hands, no extra fingers, no plastic or waxy skin, no over-smoothed airbrushed look, no flawless model face, no glossy stock-photo lighting, no AI artifacts, no logos in the image"

GOOD EXAMPLE (scroll-stopper — note the emotion, the bold product, the clean space reserved for a hook)
"A tight close-up of a young woman's face lit up with genuine surprise and a wide smile as she lifts a freshly-unboxed ceramic pour-over dripper toward the camera, shot on a 35mm lens at f/2.0 with the product sharp and her face slightly soft behind it, bright soft window light from camera-left, composed with her face and the product filling the lower two-thirds and clean uncluttered bright wall space across the top third for a text hook, punchy warm amber and cream palette with one bold pop of teal from her sweater, native creator-shot lifestyle feel (not glossy stock), 1:1 square aspect ratio composed for Instagram, photorealistic, shot on a phone camera, real natural skin texture with pores, candid and unretouched, no text overlays, no watermarks, no warped hands, no extra fingers, no plastic or waxy skin, no over-smoothed airbrushed look, no flawless model face, no glossy stock-photo lighting, no AI artifacts, no logos in the image."

BAD EXAMPLE (do NOT do this — these get scrolled past)
"A scroll-stopping image for the brand with bold colors and modern feel" — too vague.
"A woman seen from behind sitting calmly at a tidy desk with a laptop and a mug, soft neutral office, editorial commercial photography" — no face, no emotion, no product, pure stock-photo skip-fodder.

Now write the brief. Return ONLY the paragraph — no preamble, no labels, no bullet points.`;

  const result = await generateClaudeText(meta, { maxTokens: 500 });
  return result.content.trim();
}
