import "server-only";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";

export async function listSavedFoods() {
  const { userId } = await auth();
  if (!userId) throw new Error("Sign in required");
  return db.query.foods.findMany({
    columns: { id: true, name: true },
    where: { userId, isArchived: false },
    orderBy: { name: "asc", id: "asc" },
  });
}
