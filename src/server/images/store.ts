import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { AppError } from "@/server/http";
import { uuidv7 } from "@/server/ids";
import { db } from "@/server/db";

function uploadDir() {
  const root = process.env.UPLOAD_DIR;
  if (root) return root;
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data", "uploads");
}

function sniff(bytes: Buffer): boolean {
  const head = bytes.subarray(0, 200).toString("utf8").toLowerCase();
  if (head.includes("<svg") || head.includes("<?xml") || head.includes("<!doctype html")) return false;
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return true;
  const gif = bytes.toString("ascii", 0, 6);
  return gif === "GIF87a" || gif === "GIF89a";
}

async function averageHash(bytes: Buffer): Promise<string> {
  const raw = await sharp(bytes).resize(8, 8, { fit: "fill" }).greyscale().raw().toBuffer();
  const avg = raw.reduce((sum, value) => sum + value, 0) / raw.length;
  let bits = "";
  for (const value of raw) bits += value >= avg ? "1" : "0";
  return BigInt(`0b${bits}`).toString(16).padStart(16, "0");
}

function hamming(a: string, b: string): number {
  const left = BigInt(`0x${a}`);
  const right = BigInt(`0x${b}`);
  let x = left ^ right;
  let count = 0;
  while (x > 0n) {
    count += Number(x & 1n);
    x >>= 1n;
  }
  return count;
}

export async function saveCoinImage(bytes: Buffer): Promise<{ key: string; phash: string }> {
  if (bytes.length > 5_000_000) throw new AppError("IMAGE_REJECTED", "Images must be 5 MB or smaller.");
  if (!sniff(bytes)) throw new AppError("IMAGE_REJECTED", "Use a PNG, JPG, WEBP or GIF.");
  const source = sharp(bytes, { limitInputPixels: 4096 * 4096, animated: false, failOn: "error" });
  const meta = await source.metadata();
  if (!meta.width || !meta.height || meta.width < 256 || meta.height < 256 || meta.width > 4096 || meta.height > 4096) {
    throw new AppError("IMAGE_REJECTED", "Images must be between 256 and 4096 pixels on each side.");
  }
  const main = await source.rotate().resize({ width: 1080, height: 1080, fit: "inside", withoutEnlargement: false }).webp({ quality: 82 }).toBuffer();
  const thumb = await sharp(main).resize(320, 320, { fit: "cover" }).webp({ quality: 78 }).toBuffer();
  const phash = await averageHash(main);
  const blocked = await db()<{ phash: string }[]>`SELECT phash FROM blocked_hashes`;
  for (const row of blocked) {
    if (hamming(phash, row.phash) <= 6) throw new AppError("IMAGE_REJECTED", "That image isn't allowed.");
  }
  const key = uuidv7();
  const dir = uploadDir();
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${key}.webp`), main);
  await writeFile(path.join(dir, `${key}-thumb.webp`), thumb);
  return { key, phash };
}

export async function readCoinImage(key: string, thumb: boolean): Promise<Buffer | null> {
  if (!/^[0-9a-f-]{36}$/i.test(key)) return null;
  try {
    return await readFile(path.join(uploadDir(), thumb ? `${key}-thumb.webp` : `${key}.webp`));
  } catch {
    return null;
  }
}

export function imagePath(key: string, thumb = false) {
  return `/api/media/${key}${thumb ? "?size=thumb" : ""}`;
}
