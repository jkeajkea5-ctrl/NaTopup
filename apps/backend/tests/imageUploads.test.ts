import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readdir, unlink, rmdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { MAX_IMAGE_BYTES, prepareImage, validImageFilename } from "../lib/imageUploads";
import { ADMIN_COOKIE, createAdminSession } from "../lib/adminAuth";
import { POST } from "../app/api/admin/uploads/route";
import { GET } from "../app/api/media/[filename]/route";

test("uploads require a session and validate images, then serve a normalized image", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "na-upload-test-"));
  process.env.UPLOAD_DIRECTORY = directory;
  process.env.ADMIN_DASHBOARD_KEY = "test-upload-key-at-least-32-characters-long";
  process.env.ADMIN_DASHBOARD_ORIGIN = "http://localhost:5200";
  try {
    const unauthorized = await POST(new Request("http://localhost/api/admin/uploads", { method: "POST" }));
    assert.equal(unauthorized.status, 401);
    await assert.rejects(prepareImage(Buffer.from("not an image"), "image/png"));
    await assert.rejects(prepareImage(Buffer.from("<svg></svg>"), "image/svg+xml"));
    await assert.rejects(prepareImage(Buffer.alloc(MAX_IMAGE_BYTES + 1), "image/png"));
    assert.equal(validImageFilename("../../.env"), false);

    const png = await sharp({ create: { width: 2600, height: 20, channels: 4, background: "#8865c5" } }).png().toBuffer();
    const form = new FormData();
    form.append("image", new Blob([png], { type: "image/png" }), "../../test.png");
    const response = await POST(new Request("http://localhost/api/admin/uploads", {
      method: "POST", headers: { cookie: `${ADMIN_COOKIE}=${createAdminSession()}`, origin: "http://localhost:5200" }, body: form,
    }));
    assert.equal(response.status, 201);
    const body = await response.json();
    const filename = body.data.url.split("/").pop();
    assert.equal(validImageFilename(filename), true);
    const served = await GET(new Request(`http://localhost${body.data.url}`), { params: { filename } });
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("content-type"), "image/webp");
    const metadata = await sharp(Buffer.from(await served.arrayBuffer())).metadata();
    assert.equal(metadata.width, 2400);
    assert.equal(metadata.format, "webp");
    assert.equal((await GET(new Request("http://localhost"), { params: { filename: "..\\.env" } })).status, 404);
  } finally {
    for (const filename of await readdir(directory)) await unlink(path.join(directory, filename));
    await rmdir(directory);
    delete process.env.UPLOAD_DIRECTORY;
  }
});
