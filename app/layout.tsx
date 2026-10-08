import { ClerkProvider, Show, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meal Tracker",
  description: "Your personal meal tracker.",
};

export default function RootLayout({ children, theme }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <header className="border-b border-border bg-background font-sans">
              <nav
                aria-label="Main navigation"
                className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4"
              >
                <Link href="/" className="text-lg font-semibold tracking-tight">
                  Meal Tracker
                </Link>
                <div className="flex min-h-10 items-center gap-3">
                  {theme}
                  <Suspense fallback={<Skeleton className="h-9 w-36" aria-label="Loading account" />}>
                    <Show when="signed-out">
                      <Button variant="ghost" size="lg" render={<Link href="/sign-in" />} nativeButton={false}>
                        Sign in
                      </Button>
                      <Button size="lg" render={<Link href="/sign-up" />} nativeButton={false}>
                        Sign up
                      </Button>
                    </Show>
                    <Show when="signed-in">
                      <UserButton showName />
                    </Show>
                  </Suspense>
                </div>
              </nav>
            </header>
            {children}
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
