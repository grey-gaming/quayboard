import type { ReactNode } from "react";

import { PrimaryBar } from "../layout/PrimaryBar.js";

export const AppFrame = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen px-4 py-4 md:px-6">
    <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-[14rem_minmax(0,1fr)]">
      <PrimaryBar />
      <main className="space-y-4 rounded-[calc(var(--radius)+10px)] border border-border/60 bg-card/60 p-4 shadow-harbor backdrop-blur md:p-6">
        {children}
      </main>
    </div>
  </div>
);
