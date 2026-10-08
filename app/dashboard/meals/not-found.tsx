import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

export default function MealNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-8 sm:py-12">
      <Empty>
        <EmptyHeader>
          <EmptyTitle><h1>Meal unavailable</h1></EmptyTitle>
          <EmptyDescription>We couldn’t find this meal. Choose a meal from your dashboard.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button render={<Link href="/dashboard" />} nativeButton={false}>Back to dashboard</Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
