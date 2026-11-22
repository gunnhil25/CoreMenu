import { NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth-guard";
import { buildHouseholdBackupPayload } from "@/lib/export-import";
import { store } from "@/lib/store";
import { toIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await getAuthStatus();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const data = await store.exportHouseholdData();
  const payload = buildHouseholdBackupPayload(data);
  const filename = `coremenu-backup-${toIsoDate(new Date())}.json`;

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
