import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Toaster position="bottom-right" />
      <Suspense fallback={<Skeleton className="mx-auto my-12 h-80 w-full max-w-5xl" aria-label="Loading dashboard" />}>
        {children}
      </Suspense>
    </>
  );
}
