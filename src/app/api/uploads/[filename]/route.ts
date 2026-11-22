import { NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth-guard";
import { readUploadedImage } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  context: { params: Promise<{ filename: string }> }
) {
  const { user } = await getAuthStatus();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { filename } = await context.params;
  const image = await readUploadedImage(filename);
  if (!image) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.buffer), {
    status: 200,
    headers: {
      "Content-Type": image.mime,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
