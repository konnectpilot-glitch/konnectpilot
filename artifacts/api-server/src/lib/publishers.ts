import { logger } from "./logger";

export type PublishResult = {
  ok: boolean;
  platformPostId?: string;
  error?: string;
};

async function fetchImageBytes(imageUrl: string): Promise<{ bytes: Buffer; contentType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const res = await fetch(imageUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`Image fetch failed: HTTP ${res.status}`);
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    return { bytes: buf, contentType };
  } finally {
    clearTimeout(timeout);
  }
}

export async function publishToFacebook(opts: {
  // For new accountType="facebook_page" rows this IS the Page access token +
  // pageId; for legacy rows (accountType=null) it's the user access token and
  // pageId is omitted, so we fall back to /me/accounts → first Page.
  userAccessToken: string;
  pageId?: string | null;
  imageUrl: string;
  caption: string;
}): Promise<PublishResult> {
  try {
    let pageId = opts.pageId;
    let pageAccessToken = opts.userAccessToken;

    // Legacy path: no pageId stored. Re-discover via /me/accounts (this is
    // the pre-picker behavior — auto-picks first Page).
    if (!pageId) {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${encodeURIComponent(opts.userAccessToken)}`,
      );
      if (!pagesRes.ok) {
        return { ok: false, error: `Facebook pages list failed: ${await pagesRes.text()}` };
      }
      const pagesData = (await pagesRes.json()) as {
        data?: Array<{ id: string; name: string; access_token: string }>;
      };
      const page = pagesData.data?.[0];
      if (!page) {
        return {
          ok: false,
          error: "No Facebook Pages found on this account. Create or get admin access to a Page first.",
        };
      }
      pageId = page.id;
      pageAccessToken = page.access_token;
    }

    // Facebook's /photos endpoint accepts either ?url= (public HTTP image URL)
    // or source= as a multipart binary upload. Our images come from AI providers
    // as base64 data URLs, which the ?url= path rejects with "(#100) url should
    // represent a valid URL". Detect data URLs and switch to multipart upload.
    let postRes: Response;
    if (opts.imageUrl.startsWith("data:")) {
      const match = opts.imageUrl.match(/^data:([^;,]+)(?:;base64)?,(.*)$/);
      if (!match) {
        return { ok: false, error: "Invalid data URL for image" };
      }
      const mime = match[1] || "image/png";
      const b64 = match[2] || "";
      const ext = mime.split("/")[1]?.split("+")[0] ?? "png";
      const buffer = Buffer.from(b64, "base64");
      const form = new FormData();
      form.append("message", opts.caption);
      form.append("access_token", pageAccessToken);
      form.append("source", new Blob([buffer], { type: mime }), `image.${ext}`);
      postRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
        method: "POST",
        body: form,
      });
    } else {
      const params = new URLSearchParams({
        url: opts.imageUrl,
        message: opts.caption,
        access_token: pageAccessToken,
      });
      postRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
    }
    const postBody = await postRes.text();
    if (!postRes.ok) {
      return { ok: false, error: `Facebook photo publish failed: ${postBody}` };
    }
    let postJson: { id?: string; post_id?: string };
    try {
      postJson = JSON.parse(postBody);
    } catch {
      postJson = {};
    }
    return { ok: true, platformPostId: postJson.post_id ?? postJson.id };
  } catch (err: any) {
    logger.error({ err }, "publishToFacebook failed");
    return { ok: false, error: err?.message ?? "Unknown error" };
  }
}

export async function publishToInstagram(opts: {
  // For new accountType="instagram_business" rows: userAccessToken IS the
  // parent Page's access token, and igUserId is the IG Business account ID.
  // For legacy rows: userAccessToken is a user token; igUserId is omitted, so
  // we fall back to discovering the first linked IG via /me/accounts.
  userAccessToken: string;
  igUserId?: string | null;
  imageUrl: string;
  caption: string;
}): Promise<PublishResult> {
  try {
    let igUserId = opts.igUserId ?? undefined;
    let pageAccessToken = opts.userAccessToken;

    if (!igUserId) {
      const pagesRes = await fetch(
        `https://graph.facebook.com/v19.0/me/accounts?access_token=${encodeURIComponent(opts.userAccessToken)}`,
      );
      if (!pagesRes.ok) {
        return { ok: false, error: `Instagram pages list failed: ${await pagesRes.text()}` };
      }
      const pagesData = (await pagesRes.json()) as {
        data?: Array<{ id: string; name: string; access_token: string }>;
      };
      let foundPageToken: string | undefined;
      for (const page of pagesData.data ?? []) {
        const igRes = await fetch(
          `https://graph.facebook.com/v19.0/${page.id}?fields=instagram_business_account&access_token=${encodeURIComponent(page.access_token)}`,
        );
        if (!igRes.ok) continue;
        const igData = (await igRes.json()) as {
          instagram_business_account?: { id: string };
        };
        if (igData.instagram_business_account?.id) {
          igUserId = igData.instagram_business_account.id;
          foundPageToken = page.access_token;
          break;
        }
      }
      if (!igUserId || !foundPageToken) {
        return {
          ok: false,
          error:
            "No Instagram Business account found. Link an Instagram Business account to a Facebook Page first.",
        };
      }
      pageAccessToken = foundPageToken;
    }

    // Instagram's /media endpoint REQUIRES a public HTTPS image_url and won't
    // fetch data: URLs (returns "(#100) Invalid parameter"). Convert data URLs
    // to a temporary public URL served from our backend via the registered
    // image cache (see app.ts registerImageBlob + /img/:key route).
    let publicImageUrl = opts.imageUrl;
    if (publicImageUrl.startsWith("data:")) {
      const { registerImageBlob } = await import("../app");
      const key = registerImageBlob(publicImageUrl);
      const base = process.env.PUBLIC_BACKEND_URL;
      if (!base) {
        return { ok: false, error: "PUBLIC_BACKEND_URL env var not set; cannot serve image to Instagram" };
      }
      publicImageUrl = `${base.replace(/\/$/, "")}/img/${key}`;
    }

    const containerParams = new URLSearchParams({
      image_url: publicImageUrl,
      caption: opts.caption,
      access_token: pageAccessToken,
    });
    const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: containerParams.toString(),
    });
    const containerBody = await containerRes.text();
    if (!containerRes.ok) {
      return { ok: false, error: `Instagram container create failed: ${containerBody}` };
    }
    const containerJson = JSON.parse(containerBody) as { id: string };

    const publishParams = new URLSearchParams({
      creation_id: containerJson.id,
      access_token: pageAccessToken,
    });
    const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: publishParams.toString(),
    });
    const publishBody = await publishRes.text();
    if (!publishRes.ok) {
      return { ok: false, error: `Instagram publish failed: ${publishBody}` };
    }
    const publishJson = JSON.parse(publishBody) as { id: string };
    return { ok: true, platformPostId: publishJson.id };
  } catch (err: any) {
    logger.error({ err }, "publishToInstagram failed");
    return { ok: false, error: err?.message ?? "Unknown error" };
  }
}

export async function publishToLinkedIn(opts: {
  userAccessToken: string;
  platformUserId: string;
  imageUrl: string;
  caption: string;
}): Promise<PublishResult> {
  try {
    const ownerUrn = `urn:li:person:${opts.platformUserId}`;

    const registerRes = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.userAccessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        registerUploadRequest: {
          owner: ownerUrn,
          recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
          serviceRelationships: [
            { relationshipType: "OWNER", identifier: "urn:li:userGeneratedContent" },
          ],
        },
      }),
    });
    if (!registerRes.ok) {
      return { ok: false, error: `LinkedIn register upload failed: ${await registerRes.text()}` };
    }
    const registerJson = (await registerRes.json()) as {
      value?: {
        asset?: string;
        uploadMechanism?: Record<string, { uploadUrl?: string }>;
      };
    };
    const uploadMech = registerJson.value?.uploadMechanism ?? {};
    const uploadUrl = Object.values(uploadMech)[0]?.uploadUrl;
    const assetUrn = registerJson.value?.asset;
    if (!uploadUrl || !assetUrn) {
      return { ok: false, error: "LinkedIn did not return an upload URL or asset URN" };
    }

    const { bytes, contentType } = await fetchImageBytes(opts.imageUrl);

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${opts.userAccessToken}`,
        "Content-Type": contentType,
      },
      body: bytes,
    });
    if (!uploadRes.ok) {
      return { ok: false, error: `LinkedIn image upload failed: HTTP ${uploadRes.status}` };
    }

    const ugcRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${opts.userAccessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: ownerUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
          "com.linkedin.ugc.ShareContent": {
            shareCommentary: { text: opts.caption },
            shareMediaCategory: "IMAGE",
            media: [
              {
                status: "READY",
                media: assetUrn,
              },
            ],
          },
        },
        visibility: {
          "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
        },
      }),
    });
    const ugcBody = await ugcRes.text();
    if (!ugcRes.ok) {
      return { ok: false, error: `LinkedIn UGC post failed: ${ugcBody}` };
    }
    // LinkedIn returns the new resource id in the `x-restli-id` header; the
    // body may be empty or a JSON object with `id`. Try header first.
    const restliId = ugcRes.headers.get("x-restli-id");
    let bodyId: string | undefined;
    if (ugcBody.trim()) {
      try {
        bodyId = (JSON.parse(ugcBody) as { id?: string }).id;
      } catch {
        // ignore — body wasn't JSON
      }
    }
    return { ok: true, platformPostId: restliId ?? bodyId };
  } catch (err: any) {
    logger.error({ err }, "publishToLinkedIn failed");
    return { ok: false, error: err?.message ?? "Unknown error" };
  }
}
