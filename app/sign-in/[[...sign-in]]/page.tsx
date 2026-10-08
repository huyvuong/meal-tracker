import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Suspense
        fallback={
          <p role="status" className="text-sm text-zinc-500">
            Loading sign in…
          </p>
        }
      >
        <SignIn />
      </Suspense>
    </main>
  );
}
