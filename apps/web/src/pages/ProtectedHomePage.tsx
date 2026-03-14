import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Spinner } from "../components/ui/Spinner.js";
import { useCurrentUserQuery, useLogoutMutation } from "../hooks/use-auth.js";

export const ProtectedHomePage = () => {
  const currentUserQuery = useCurrentUserQuery();
  const logoutMutation = useLogoutMutation();

  if (currentUserQuery.isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner />
      </main>
    );
  }

  const user = currentUserQuery.data?.user;

  return (
    <main className="min-h-screen px-6 py-16">
      <section className="mx-auto grid max-w-5xl gap-6">
        <Card>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Quayboard
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight">
            M1 API Foundation
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
            The product UI stays intentionally small in this milestone. Authentication,
            session cookies, protected API routes, SSE, and project-scoped secret
            storage are now in place for the milestones that follow.
          </p>
        </Card>
        <Card className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="text-lg font-semibold">{user?.displayName}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
          <Button
            disabled={logoutMutation.isPending}
            onClick={() => {
              void logoutMutation.mutateAsync();
            }}
            variant="secondary"
          >
            Sign out
          </Button>
        </Card>
      </section>
    </main>
  );
};
