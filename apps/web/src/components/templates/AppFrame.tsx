import type { ReactNode } from "react";

import { useCurrentUserQuery, useLogoutMutation } from "../../hooks/use-auth.js";
import { GlobalHeader } from "../layout/GlobalHeader.js";

export const AppFrame = ({ children }: { children: ReactNode }) => {
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();

  return (
    <div className="min-h-screen px-4 py-4 md:px-5 md:py-5">
      <div className="mx-auto max-w-screen-2xl space-y-4">
        <GlobalHeader
          isSigningOut={logoutMutation.isPending}
          onSignOut={() => {
            void logoutMutation.mutateAsync();
          }}
          projectsHref="/"
          user={currentUserQuery.data?.user ?? null}
        />
        <main className="space-y-5 border border-border/90 bg-panel px-4 py-5 md:px-5 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
};
