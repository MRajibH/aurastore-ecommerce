import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

// Allowed image types mapped to their canonical file extension.
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export type UploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string; status: number };

/**
 * Validate and persist an uploaded image to public/images/<subdir>. The client
 * filename is ignored in favour of a random UUID to prevent path traversal and
 * overwrites. Returns the public URL, or a structured error.
 */
export async function saveImageUpload(
  file: FormDataEntryValue | null,
  subdir: string,
): Promise<UploadResult> {
  if (!file || typeof file === 'string') {
    return { ok: false, error: 'No file provided', status: 400 };
  }

  const upload = file as File;

  // Never trust the extension; validate by MIME type.
  const ext = ALLOWED_TYPES[upload.type];
  if (!ext) {
    return { ok: false, error: 'Unsupported file type. Use JPEG, PNG, WebP, or GIF.', status: 400 };
  }
  if (upload.size > MAX_SIZE_BYTES) {
    return { ok: false, error: 'File is too large. Maximum size is 5 MB.', status: 400 };
  }

  const filename = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'images', subdir);
  await mkdir(dir, { recursive: true });

  const buffer = Buffer.from(await upload.arrayBuffer());
  await writeFile(path.join(dir, filename), buffer);

  return { ok: true, url: `/images/${subdir}/${filename}` };
}
