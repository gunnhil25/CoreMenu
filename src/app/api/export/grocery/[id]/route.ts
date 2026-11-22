import { NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth-guard";
import { formatGroceryListAsCsv } from "@/lib/grocery-engine";
import { store } from "@/lib/store";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { user } = await getAuthStatus();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await context.params;
  const list = await store.getGroceryListById(id);
  if (!list) {
    return NextResponse.json({ error: "Grocery list not found." }, { status: 404 });
  }

  const items = await store.listGroceryItems(list.id);
  const url = new URL(req.url);
  const format = url.searchParams.get("format") || "csv";
  const baseName = slugify(list.name) || "grocery-list";

  if (format === "json") {
    const payload = {
      app: "coremenu",
      list,
      items,
      category: "Groceries",
      totalEstimatedCost: list.estimatedTotal,
      totalActualCost: list.actualTotal,
    };
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${baseName}.json"`,
      },
    });
  }

  const csv = formatGroceryListAsCsv(list, items);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseName}.csv"`,
    },
  });
}
