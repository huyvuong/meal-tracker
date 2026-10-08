import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export default clerkMiddleware(async (auth, request) => {
  if (request.nextUrl.pathname === "/dashboard" || request.nextUrl.pathname.startsWith("/dashboard/")) {
    await auth.protect();
  }

  if (request.nextUrl.pathname === "/") {
    const { userId } = await auth();

    if (userId) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
