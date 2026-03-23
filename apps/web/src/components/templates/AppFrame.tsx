import type { ReactNode } from "react";

import { useCurrentUserQuery, useLogoutMutation } from "../../hooks/use-auth.js";
import { GlobalHeader } from "../layout/GlobalHeader.js";

export const AppFrame = ({
  children,
  subHeader,
}: {
  children: ReactNode;
  subHeader?: ReactNode;
}) => {
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();

  return (
    <div className="min-h-screen px-3 py-2 md:px-4 md:py-3">
      <div className={["mx-auto max-w-screen-2xl", subHeader ? "space-y-0" : "space-y-3"].join(" ")}>
        <GlobalHeader
          isSigningOut={logoutMutation.isPending}
          onSignOut={() => {
            void logoutMutation.mutateAsync();
          }}
          projectsHref="/"
          user={currentUserQuery.data?.user ?? null}
        />
        {subHeader ? subHeader : null}
        <main className="space-y-5 border border-border/90 bg-panel px-4 py-5 md:px-5 md:py-6">
          {children}
        </main>
      </div>
    </div>
  );
};
