export const dynamic = "force-dynamic";

import { Suspense } from "react";
import NavigationClient from "./NavigationClient";

export default function NavigationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
            <p>Loading navigation...</p>
          </div>
        </main>
      }
    >
      <NavigationClient />
    </Suspense>
  );
}
