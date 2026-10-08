import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <Suspense
        fallback={
          <p role="status" className="text-sm text-zinc-500">
            Loading sign up…
          </p>
        }
      >
        <SignUp />
      </Suspense>
    </main>
  );
}
