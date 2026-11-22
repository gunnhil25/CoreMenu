import { NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth-guard";
import { MAX_UPLOAD_BYTES, saveUploadedImage } from "@/lib/uploads";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { user } = await getAuthStatus();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Missing image file field." }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "Image exceeds the 5MB upload limit." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await saveUploadedImage(buffer);
    return NextResponse.json(saved, { status: 201 });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload image.",
      },
      { status: 400 }
    );
  }
}
