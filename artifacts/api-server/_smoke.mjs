import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
const region = process.env.AWS_REGION || "eu-north-1";
const modelId = process.env.BEDROCK_CLAUDE_MODEL_ID;
console.log("region:", region);
console.log("modelId set:", !!modelId);
console.log("AWS_BEARER_TOKEN_BEDROCK set:", !!process.env.AWS_BEARER_TOKEN_BEDROCK);
console.log("GOOGLE_API_KEY_NANO_BANNA set:", !!process.env.GOOGLE_API_KEY_NANO_BANNA);

const client = new BedrockRuntimeClient({ region });
try {
  const t0 = Date.now();
  const out = await client.send(new ConverseCommand({
    modelId,
    messages: [{ role: "user", content: [{ text: "Say only the word: PONG" }] }],
    inferenceConfig: { maxTokens: 16 },
  }));
  const text = (out.output?.message?.content ?? []).map(b => b.text || "").join("");
  console.log(`CLAUDE OK (${Date.now()-t0}ms):`, JSON.stringify(text), "usage:", out.usage);
} catch (e) {
  console.error("CLAUDE FAILED:", e.name, e.message);
}

const apiKey = process.env.GOOGLE_API_KEY_NANO_BANNA;
try {
  const t0 = Date.now();
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "A single red apple on a white background, photorealistic" }] }] }),
  });
  if (!r.ok) { console.error("NANO FAILED HTTP", r.status, (await r.text()).slice(0,300)); }
  else {
    const j = await r.json();
    const part = j?.candidates?.[0]?.content?.parts?.find(p => p?.inlineData?.data);
    console.log(`NANO OK (${Date.now()-t0}ms): mime=${part?.inlineData?.mimeType} bytes=${part?.inlineData?.data?.length ?? 0}`);
  }
} catch (e) {
  console.error("NANO FAILED:", e.name, e.message);
}
