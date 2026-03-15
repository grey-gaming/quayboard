import type { ReactNode } from "react";

import { useCurrentUserQuery, useLogoutMutation } from "../../hooks/use-auth.js";
import { GlobalHeader } from "../layout/GlobalHeader.js";

export const AppFrame = ({ children }: { children: ReactNode }) => {
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();

  return (
    <div className="min-h-screen px-4 py-4 md:px-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <GlobalHeader
          isSigningOut={logoutMutation.isPending}
          onSignOut={() => {
            void logoutMutation.mutateAsync();
          }}
          projectsHref="/"
          user={currentUserQuery.data?.user ?? null}
        />
        <main className="space-y-4 rounded-[calc(var(--radius)+10px)] border border-border/60 bg-card/60 p-4 shadow-harbor backdrop-blur md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
