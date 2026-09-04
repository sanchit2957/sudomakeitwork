import type { Express } from "express";
import { ENV } from "./env";
import { sdk } from "./sdk";

export function registerStorageProxy(app: Express) {
  const handleStorageGet = async (req: any, res: any) => {
    const key = (req.params as Record<string, string>)[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }

    // Require authentication for sensitive emergency evidence and voice notes
    const isPrivate =
      key.startsWith("evidence/") ||
      key.startsWith("voicenotes/") ||
      key.startsWith("private/") ||
      key.includes("incident");

    if (isPrivate) {
      try {
        const user = await sdk.authenticateRequest(req);
        if (!user) {
          res.status(401).send("Authentication required for private emergency records");
          return;
        }
      } catch {
        res.status(401).send("Authentication required for private emergency records");
        return;
      }
    }

    try {
      if (ENV.forgeApiUrl && ENV.forgeApiKey) {
        const forgeUrl = new URL(
          "v1/storage/presign/get",
          ENV.forgeApiUrl.replace(/\/+$/, "") + "/",
        );
        forgeUrl.searchParams.set("path", key);

        const forgeResp = await fetch(forgeUrl, {
          headers: { Authorization: `Bearer ${ENV.forgeApiKey}` },
        });

        if (!forgeResp.ok) {
          const body = await forgeResp.text().catch(() => "");
          console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
          res.status(502).send("Storage backend error");
          return;
        }

        const { url } = (await forgeResp.json()) as { url: string };
        if (!url) {
          res.status(502).send("Empty signed URL from backend");
          return;
        }

        res.set("Cache-Control", "no-store");
        res.redirect(307, url);
        return;
      }

      const { isS3Configured, storageGetSignedUrl } = await import("../storage");
      if (isS3Configured()) {
        const signedUrl = await storageGetSignedUrl(key);
        res.set("Cache-Control", "no-store");
        res.redirect(307, signedUrl);
        return;
      }

      // Dev fallback: redirect to local static uploads
      res.redirect(307, `/uploads/${key}`);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  };

  app.get("/storage/*", handleStorageGet);
}
