import { NextResponse } from "next/server";
import { getAuthStatus } from "@/lib/auth-guard";
import {
  exportCookbookToMarkdown,
  exportRecipeToMarkdown,
} from "@/lib/export-import";
import { store } from "@/lib/store";
import { slugify, toIsoDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { user } = await getAuthStatus();
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const url = new URL(req.url);
  const recipeId = url.searchParams.get("recipeId");

  if (recipeId) {
    const recipe = await store.getRecipeById(recipeId);
    if (!recipe) {
      return NextResponse.json({ error: "Recipe not found." }, { status: 404 });
    }
    const md = exportRecipeToMarkdown(recipe);
    const filename = `${slugify(recipe.title)}.md`;
    return new NextResponse(md, {
      status: 200,
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const recipes = await store.listRecipes();
  const md = exportCookbookToMarkdown(recipes);
  const filename = `coremenu-cookbook-${toIsoDate(new Date())}.md`;
  return new NextResponse(md, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
