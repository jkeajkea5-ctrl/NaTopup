import { readFile } from "node:fs/promises";
import path from "node:path";
import { uploadDirectory, validImageFilename } from "../../../../lib/imageUploads";
import { config } from "../../../../lib/config";

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
    // Serverless filesystems do not retain dashboard uploads between
    // deployments. Existing uploads are mirrored in the frontend's static
    // media directory so their original /api/media URLs remain valid.
    const staticUrl = new URL(`/media/${params.filename}`, config.frontendUrl);
    return new Response(null, {
      status: 307,
      headers: {
        Location: staticUrl.toString(),
        "Cache-Control": "public, max-age=300",
      },
    });
  }
}
