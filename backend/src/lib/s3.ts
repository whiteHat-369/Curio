import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";
import fs from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";

const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER ?? (process.env.S3_ACCESS_KEY_ID ? "s3" : "local");
const UPLOADS_DIR = path.resolve(process.cwd(), process.env.LOCAL_UPLOADS_DIR ?? "uploads");

// Initialize S3 client if S3 credentials exist
let s3Client: S3Client | null = null;
if (STORAGE_PROVIDER === "s3" && process.env.S3_ACCESS_KEY_ID) {
  s3Client = new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
    forcePathStyle: true, // Required for MinIO / S3 compatible
  });
}

const BUCKET = process.env.S3_BUCKET ?? "curio-files";

/**
 * Sanitize object key to prevent path traversal vulnerability.
 */
function sanitizeKey(key: string): string {
  return key.replace(/\.\./g, "").replace(/[^a-zA-Z0-9/._-]/g, "_");
}

export async function uploadFile(
  key: string,
  body: Readable | Buffer | Uint8Array | Blob,
  contentType: string,
): Promise<void> {
  const safeKey = sanitizeKey(key);

  if (STORAGE_PROVIDER === "s3" && s3Client) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: safeKey,
        Body: body as any,
        ContentType: contentType,
      }),
    );
    return;
  }

  // Local storage fallback
  const filePath = path.join(UPLOADS_DIR, safeKey);
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  if (Buffer.isBuffer(body) || body instanceof Uint8Array) {
    await fs.writeFile(filePath, body);
  } else if (typeof (body as any).pipe === "function") {
    const writeStream = createWriteStream(filePath);
    await pipeline(body as Readable, writeStream);
  } else {
    const arrayBuffer = await (body as Blob).arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));
  }
}

export async function deleteFile(key: string): Promise<void> {
  const safeKey = sanitizeKey(key);

  if (STORAGE_PROVIDER === "s3" && s3Client) {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET,
        Key: safeKey,
      }),
    );
    return;
  }

  const filePath = path.join(UPLOADS_DIR, safeKey);
  try {
    await fs.unlink(filePath);
  } catch (err: any) {
    if (err.code !== "ENOENT") throw err;
  }
}

export async function getSignedDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const safeKey = sanitizeKey(key);

  if (STORAGE_PROVIDER === "s3" && s3Client) {
    const command = new GetObjectCommand({
      Bucket: BUCKET,
      Key: safeKey,
    });
    return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
  }

  // Local storage download URL endpoint
  const apiBase = process.env.API_PUBLIC_URL ?? "http://localhost:3001";
  return `${apiBase}/api/v1/files/download/${encodeURIComponent(safeKey)}`;
}

export function generateFileKey(workspaceId: string, userId: string, originalName: string): string {
  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `workspaces/${workspaceId}/users/${userId}/${timestamp}-${safeName}`;
}