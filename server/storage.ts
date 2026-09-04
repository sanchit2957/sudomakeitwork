// Storage helpers
// Supports Forge Server presigned URL, Direct AWS/Cloudflare S3, or local filesystem fallback with warnings.
// Downloads return /storage/{key} paths served via 307 redirect or /uploads/{key} locally.

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "./_core/env";

function getForgeConfig() {
  const forgeUrl = ENV.forgeApiUrl;
  const forgeKey = ENV.forgeApiKey;

  if (!forgeUrl || !forgeKey) {
    throw new Error(
      "Storage config missing: set BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY",
    );
  }

  return { forgeUrl: forgeUrl.replace(/\/+$/, ""), forgeKey };
}

export function isS3Configured(): boolean {
  return Boolean(ENV.s3Bucket && ENV.s3AccessKeyId && ENV.s3SecretAccessKey);
}

let cachedS3Client: S3Client | null = null;
export function getS3Client(): { s3: S3Client; bucket: string } {
  if (!isS3Configured()) {
    throw new Error("S3 is not configured: set AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY");
  }

  if (!cachedS3Client) {
    cachedS3Client = new S3Client({
      region: ENV.s3Region || "us-east-1",
      credentials: {
        accessKeyId: ENV.s3AccessKeyId,
        secretAccessKey: ENV.s3SecretAccessKey,
      },
      ...(ENV.s3Endpoint ? { endpoint: ENV.s3Endpoint, forcePathStyle: true } : {}),
    });
  }

  return { s3: cachedS3Client, bucket: ENV.s3Bucket };
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, "");
}

function appendHashSuffix(relKey: string): string {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const buffer = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);

  // 1. Forge Storage Branch
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    console.log(`[Storage] Using Forge presigned upload for key: ${key}`);
    const { forgeUrl, forgeKey } = getForgeConfig();

    const presignUrl = new URL("v1/storage/presign/put", forgeUrl + "/");
    presignUrl.searchParams.set("path", key);

    const presignResp = await fetch(presignUrl, {
      headers: { Authorization: `Bearer ${forgeKey}` },
    });

    if (!presignResp.ok) {
      const msg = await presignResp.text().catch(() => presignResp.statusText);
      throw new Error(`Storage presign failed (${presignResp.status}): ${msg}`);
    }

    const { url: s3Url } = (await presignResp.json()) as { url: string };
    if (!s3Url) throw new Error("Forge returned empty presign URL");

    const uploadResp = await fetch(s3Url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: new Blob([buffer], { type: contentType }),
    });

    if (!uploadResp.ok) {
      throw new Error(`Storage upload to S3 failed (${uploadResp.status})`);
    }

    return { key, url: `/storage/${key}` };
  }

  // 2. Direct S3 Branch (AWS S3, Cloudflare R2, MinIO, Backblaze B2)
  if (isS3Configured()) {
    try {
      const { s3, bucket } = getS3Client();
      console.log(`[Storage] Using direct S3 upload for key: ${key} (bucket: ${bucket}, region: ${ENV.s3Region})`);

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: buffer,
          ContentType: contentType,
        }),
      );

      return { key, url: `/storage/${key}` };
    } catch (s3Error) {
      console.error("[Storage] Direct S3 upload error:", s3Error);
      throw s3Error;
    }
  }

  // 3. Local filesystem fallback (dev only)
  console.warn(
    `[Storage] WARNING: Neither Forge nor AWS_S3 credentials configured! Falling back to local disk for '${key}'. ` +
    `Note: On ephemeral container platforms like Render, locally uploaded voice notes will not persist across restarts.`
  );

  try {
    const fs = await import("fs/promises");
    const path = await import("path");
    const uploadsDir = path.resolve(process.cwd(), "client/public/uploads", path.dirname(key));
    await fs.mkdir(uploadsDir, { recursive: true });
    const filePath = path.resolve(process.cwd(), "client/public/uploads", key);
    await fs.writeFile(filePath, buffer);
    return { key, url: `/uploads/${key}` };
  } catch (localError) {
    console.error("[Storage] Local file save error:", localError);
    return { key, url: "" };
  }
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  if (!ENV.forgeApiUrl && !isS3Configured()) {
    return { key, url: `/uploads/${key}` };
  }
  return { key, url: `/storage/${key}` };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  const key = normalizeKey(relKey);

  // 1. Forge
  if (ENV.forgeApiUrl && ENV.forgeApiKey) {
    const { forgeUrl, forgeKey } = getForgeConfig();
    const getUrl = new URL("v1/storage/presign/get", forgeUrl + "/");
    getUrl.searchParams.set("path", key);

    const resp = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${forgeKey}` },
    });

    if (!resp.ok) {
      const msg = await resp.text().catch(() => resp.statusText);
      throw new Error(`Storage signed URL failed (${resp.status}): ${msg}`);
    }

    const { url } = (await resp.json()) as { url: string };
    return url;
  }

  // 2. Direct S3
  if (isS3Configured()) {
    const { s3, bucket } = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return await getSignedUrl(s3, command, { expiresIn: 3600 });
  }

  // 3. Local fallback
  return `/uploads/${key}`;
}
