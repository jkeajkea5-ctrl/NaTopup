import { validImageFilename } from "../../../../lib/imageUploads";
import { config } from "../../../../lib/config";
import { readMedia } from "../../../../lib/mediaStorage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { filename: string } }) {
  if (!validImageFilename(params.filename)) return new Response("Not found", { status: 404 });
  const asset = await readMedia(params.filename);
  if (asset) {
    return new Response(new Uint8Array(asset.data), { headers: {
      "Content-Type": asset.contentType, "Content-Length": String(asset.data.length),
      "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
    } });
  }

  // Media uploaded before persistent storage was introduced is mirrored in
  // the frontend's static media directory.
  const staticUrl = new URL(`/media/${params.filename}`, config.frontendUrl);
  return new Response(null, {
    status: 307,
    headers: {
      Location: staticUrl.toString(),
      "Cache-Control": "public, max-age=300",
    },
  });
}
