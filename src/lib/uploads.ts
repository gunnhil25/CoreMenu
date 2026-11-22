import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

const ALLOWED_SIGNATURES: Array<{
  ext: string;
  mime: string;
  match: (buf: Buffer) => boolean;
}> = [
  {
    ext: "jpg",
    mime: "image/jpeg",
    match: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "png",
    mime: "image/png",
    match: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    ext: "gif",
    mime: "image/gif",
    match: (b) =>
      b.length >= 6 &&
      (b.subarray(0, 6).toString("ascii") === "GIF87a" ||
        b.subarray(0, 6).toString("ascii") === "GIF89a"),
  },
  {
    ext: "webp",
    mime: "image/webp",
    match: (b) =>
      b.length >= 12 &&
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

interface MemoryUploadEntry {
  buffer: Buffer;
  mime: string;
}

const g = globalThis as typeof globalThis & {
  __coreMenuMemoryUploads?: Map<string, MemoryUploadEntry>;
};

function getMemoryUploads(): Map<string, MemoryUploadEntry> {
  if (!g.__coreMenuMemoryUploads) {
    g.__coreMenuMemoryUploads = new Map();
  }
  return g.__coreMenuMemoryUploads;
}

export function getUploadDir(): string {
  return process.env.UPLOAD_DIR || path.join(process.cwd(), "data", "uploads");
}

export function detectImageFormat(buffer: Buffer): { ext: string; mime: string } | null {
  for (const sig of ALLOWED_SIGNATURES) {
    if (sig.match(buffer)) {
      return { ext: sig.ext, mime: sig.mime };
    }
  }
  return null;
}

export function isSafeUploadFilename(filename: string): boolean {
  return /^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|gif|webp)$/i.test(filename);
}

export async function saveUploadedImage(buffer: Buffer): Promise<{
  filename: string;
  url: string;
  mime: string;
}> {
  if (buffer.length === 0) {
    throw new Error("Uploaded file is empty.");
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error("Image exceeds the 5MB upload limit.");
  }

  const detected = detectImageFormat(buffer);
  if (!detected) {
    throw new Error("Unsupported image format. Please upload a JPEG, PNG, WebP, or GIF image.");
  }

  const filename = `${crypto.randomUUID()}.${detected.ext}`;

  if (process.env.COREMENU_USE_IN_MEMORY === "true" || process.env.NODE_ENV === "test") {
    getMemoryUploads().set(filename, { buffer, mime: detected.mime });
    return { filename, url: `/api/uploads/${filename}`, mime: detected.mime };
  }

  const dir = getUploadDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);
  return { filename, url: `/api/uploads/${filename}`, mime: detected.mime };
}

export async function readUploadedImage(filename: string): Promise<{
  buffer: Buffer;
  mime: string;
} | null> {
  if (!isSafeUploadFilename(filename)) {
    return null;
  }

  const memEntry = getMemoryUploads().get(filename);
  if (memEntry) {
    return memEntry;
  }

  if (process.env.COREMENU_USE_IN_MEMORY === "true" || process.env.NODE_ENV === "test") {
    return null;
  }

  const dir = path.resolve(getUploadDir());
  const fullPath = path.resolve(dir, filename);
  if (!fullPath.startsWith(`${dir}${path.sep}`)) {
    return null;
  }

  try {
    const buffer = await fs.readFile(fullPath);
    const ext = path.extname(filename).toLowerCase();
    return {
      buffer,
      mime: MIME_BY_EXT[ext] || "application/octet-stream",
    };
  } catch {
    return null;
  }
}
