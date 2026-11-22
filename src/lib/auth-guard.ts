import { revalidatePath } from "next/cache";
import { getSessionPayload } from "@/lib/auth";
import { store } from "@/lib/store";
import type { SafeUser, UserRecord } from "@/lib/types";

export function safeRevalidatePaths(paths: string[]): void {
  for (const p of paths) {
    try {
      revalidatePath(p);
    } catch {
      // Outside Next.js request/static-generation store (e.g. Vitest)
    }
  }
}

export function toSafeUser(user: UserRecord): SafeUser {
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

export async function getAuthStatus(): Promise<{
  initialized: boolean;
  user: SafeUser | null;
}> {
  const userCount = await store.getUserCount();
  if (userCount === 0) {
    return { initialized: false, user: null };
  }

  const session = await getSessionPayload();
  if (!session) {
    return { initialized: true, user: null };
  }

  const user = await store.getUserById(session.userId);
  if (!user || !user.isActive || user.sessionVersion !== session.sessionVersion) {
    return { initialized: true, user: null };
  }

  return { initialized: true, user: toSafeUser(user) };
}

export async function requireAuth(): Promise<SafeUser> {
  const { user } = await getAuthStatus();
  if (!user) {
    throw new Error("Authentication required.");
  }
  return user;
}

export async function requireAdmin(): Promise<SafeUser> {
  const user = await requireAuth();
  if (user.role !== "admin") {
    throw new Error("Administrator privileges required.");
  }
  return user;
}
