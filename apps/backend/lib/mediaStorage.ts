import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./prisma";
import { uploadDirectory } from "./imageUploads";

export type StoredMedia = {
  data: Buffer;
  contentType: string;
};

// Tests and explicitly configured self-hosted installations may use disk.
// Vercel and normal deployments use MongoDB because serverless disks are
// temporary and are not shared between function instances.
function usesConfiguredDisk() {
  return Boolean(process.env.UPLOAD_DIRECTORY);
}

export async function storeMedia(filename: string, data: Buffer): Promise<void> {
  if (usesConfiguredDisk()) {
    await mkdir(uploadDirectory(), { recursive: true });
    await writeFile(path.join(uploadDirectory(), filename), data, { flag: "wx" });
    return;
  }

  await (prisma as any).mediaAsset.create({
    data: {
      filename,
      data,
      contentType: "image/webp",
      size: data.length,
    },
  });
}

export async function readMedia(filename: string): Promise<StoredMedia | null> {
  if (usesConfiguredDisk()) {
    try {
      return { data: await readFile(path.join(uploadDirectory(), filename)), contentType: "image/webp" };
    } catch {
      return null;
    }
  }

  try {
    const asset = await (prisma as any).mediaAsset.findUnique({
      where: { filename },
      select: { data: true, contentType: true },
    });
    if (!asset) return null;
    return { data: Buffer.from(asset.data), contentType: asset.contentType };
  } catch {
    return null;
  }
}
