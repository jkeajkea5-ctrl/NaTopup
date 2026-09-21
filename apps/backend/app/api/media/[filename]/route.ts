import { readFile } from "node:fs/promises";
import path from "node:path";
import { uploadDirectory, validImageFilename } from "../../../../lib/imageUploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { filename: string } }) {
  if (!validImageFilename(params.filename)) return new Response("Not found", { status: 404 });
  try {
    const bytes = await readFile(path.join(uploadDirectory(), params.filename));
    return new Response(bytes, { headers: {
      "Content-Type": "image/webp", "Content-Length": String(bytes.length),
      "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
