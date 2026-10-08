import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkProvider>
          <header className="border-b border-zinc-200 bg-white font-sans dark:border-zinc-800 dark:bg-black">
            <nav
              aria-label="Main navigation"
              className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4"
            >
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Meal Tracker
              </Link>
              <div className="flex min-h-10 items-center gap-3">
                <Suspense
                  fallback={
                    <span role="status" className="text-sm text-zinc-500">
                      Loading account…
                    </span>
                  }
                >
                  <Show when="signed-out">
                    <SignInButton mode="modal">
                      <button className="rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 dark:hover:bg-zinc-900">
                        Sign in
                      </button>
                    </SignInButton>
                    <SignUpButton mode="modal">
                      <button className="rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200">
                        Sign up
                      </button>
                    </SignUpButton>
                  </Show>
                  <Show when="signed-in">
                    <UserButton showName />
                  </Show>
                </Suspense>
              </div>
            </nav>
          </header>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
