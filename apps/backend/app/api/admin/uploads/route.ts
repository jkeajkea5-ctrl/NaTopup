import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminWithIp } from "../../../../lib/adminAuth";
import { MAX_IMAGE_BYTES, prepareImage } from "../../../../lib/imageUploads";
import { storeMedia } from "../../../../lib/mediaStorage";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = await requireAdminWithIp(request);
  if (denied) return denied;
  const limit = MAX_IMAGE_BYTES + 64 * 1024;
  if (Number(request.headers.get("content-length")) > limit) {
    return NextResponse.json({ success: false, error: "Images must be smaller than 5 MB." }, { status: 413 });
  }
  // Limit streamed bodies too, including requests without Content-Length.
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ success: false, error: "Choose an image to upload." }, { status: 400 });
  let image: Buffer;
  try {
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return NextResponse.json({ success: false, error: "Images must be smaller than 5 MB." }, { status: 413 });
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") || "" } }).formData();
    const file = form.get("image");
    if (!file || typeof file === "string") throw new Error("Missing image");
    image = await prepareImage(Buffer.from(await file.arrayBuffer()), file.type);
  } catch {
    return NextResponse.json({ success: false, error: "Choose a valid JPG, PNG, or WebP image under 5 MB and 20 megapixels." }, { status: 400 });
  }
  try {
    const filename = `${randomUUID()}.webp`;
    await storeMedia(filename, image);
    return NextResponse.json({ success: true, data: { url: `/api/media/${filename}` } }, { status: 201 });
  } catch {
    return NextResponse.json({ success: false, error: "The image could not be stored. Please try again." }, { status: 500 });
  }
}
