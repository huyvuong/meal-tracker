import "server-only";

import { auth } from "@clerk/nextjs/server";

export default async function NewMealLayout({ children }: { children: React.ReactNode }) {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn({ returnBackUrl: "/dashboard/meals/new" });
  return children;
}
