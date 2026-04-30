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
  userAccessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<PublishResult> {
  try {
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

    const params = new URLSearchParams({
      url: opts.imageUrl,
      message: opts.caption,
      access_token: page.access_token,
    });
    const postRes = await fetch(`https://graph.facebook.com/v19.0/${page.id}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
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
  userAccessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<PublishResult> {
  try {
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?access_token=${encodeURIComponent(opts.userAccessToken)}`,
    );
    if (!pagesRes.ok) {
      return { ok: false, error: `Instagram pages list failed: ${await pagesRes.text()}` };
    }
    const pagesData = (await pagesRes.json()) as {
      data?: Array<{ id: string; name: string; access_token: string }>;
    };
    let igUserId: string | undefined;
    let pageAccessToken: string | undefined;
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
        pageAccessToken = page.access_token;
        break;
      }
    }
    if (!igUserId || !pageAccessToken) {
      return {
        ok: false,
        error:
          "No Instagram Business account found. Link an Instagram Business account to a Facebook Page first.",
      };
    }

    const containerParams = new URLSearchParams({
      image_url: opts.imageUrl,
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
