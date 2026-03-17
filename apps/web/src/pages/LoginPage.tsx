import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";

import { ReadinessChecksList } from "../components/workflow/ReadinessChecksList.js";
import { Alert } from "../components/ui/Alert.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Spinner } from "../components/ui/Spinner.js";
import { useLoginMutation } from "../hooks/use-auth.js";
import {
  isSystemReadinessReady,
  useSystemReadinessQuery,
} from "../hooks/use-system-readiness.js";

type LoginFormValues = {
  email: string;
  password: string;
};

export const LoginPage = () => {
  const loginMutation = useLoginMutation();
  const readinessQuery = useSystemReadinessQuery();
  const location = useLocation();
  const navigate = useNavigate();
  const isReady = isSystemReadinessReady(readinessQuery.data);
  const authBlocked = readinessQuery.isLoading || readinessQuery.isError || !isReady;
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await loginMutation.mutateAsync(values);
    navigate((location.state as { from?: string } | null)?.from ?? "/");
  });

  return (
    <main className="min-h-screen px-4 py-4 md:px-5 md:py-5">
      <div className="mx-auto grid max-w-screen-xl gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="flex flex-col justify-between" surface="panel">
          <div>
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Quayboard
            </p>
            <h1 className="mt-3 font-display text-[2rem] font-semibold tracking-[-0.02em]">
              Instance Readiness
            </h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-secondary">
              Review the instance checks on this page. Sign-in unlocks here once every
              check passes.
            </p>
          </div>
          <div className="grid gap-4 pt-8">
            {readinessQuery.isLoading ? (
              <div className="flex min-h-32 items-center justify-center">
                <Spinner />
              </div>
            ) : readinessQuery.error ? (
              <Alert tone="error">
                {readinessQuery.error.message} Check the API logs, then review the{" "}
                <Link
                  className="underline decoration-accent/60 underline-offset-4 hover:decoration-accent"
                  to="/docs/first-install"
                >
                  first install guide
                </Link>
                .
              </Alert>
            ) : readinessQuery.data ? (
              <>
                <div className="qb-data-row">
                  <p className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Page status
                  </p>
                  <p className="mt-2 text-sm text-foreground">
                    {isReady
                      ? "All instance checks are green. You can sign in from this page."
                      : "Sign-in stays locked until every failed check below is fixed."}
                  </p>
                </div>
                {!isReady ? (
                  <Alert>
                    Review the failed checks below. If this is a first-time setup, open the{" "}
                    <Link
                      className="underline decoration-accent/60 underline-offset-4 hover:decoration-accent"
                      to="/docs/first-install"
                    >
                      first install guide
                    </Link>
                    .
                  </Alert>
                ) : null}
                <ReadinessChecksList checks={readinessQuery.data.checks} />
              </>
            ) : null}
          </div>
        </Card>
        <Card className="w-full" surface="panel">
          <div className="mb-6 space-y-2 border-b border-border/80 pb-4">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Operator Login
            </p>
            <h2 className="font-display text-[1.7rem] font-semibold tracking-[-0.02em]">Sign in</h2>
            <p className="text-sm text-secondary">
              Sign in with your local account to access your projects and planning tools.
            </p>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              autoComplete="email"
              {...register("email", { required: "Email is required." })}
            />
            {errors.email ? <Alert tone="error">{errors.email.message}</Alert> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register("password", {
                required: "Password is required.",
                minLength: {
                  value: 8,
                  message: "Password must be at least 8 characters.",
                },
              })}
            />
            {errors.password ? (
              <Alert tone="error">{errors.password.message}</Alert>
            ) : null}
          </div>
          {loginMutation.error ? (
            <Alert tone="error">{loginMutation.error.message}</Alert>
          ) : null}
          {authBlocked ? (
            <Alert>
              Sign-in is unavailable until the failed readiness checks are resolved.
            </Alert>
          ) : null}
          <Button className="w-full" disabled={loginMutation.isPending || authBlocked} type="submit">
            {loginMutation.isPending ? <Spinner /> : "Sign in"}
          </Button>
          </form>
          <p className="mt-6 text-sm text-secondary">
            Need an account?{" "}
            <Link className="text-foreground underline decoration-accent/60 underline-offset-4 hover:decoration-accent" to="/register">
              Register
            </Link>
          </p>
          <p className="mt-3 text-sm text-secondary">
            Prefer the product guide first?{" "}
            <Link className="text-foreground underline decoration-accent/60 underline-offset-4 hover:decoration-accent" to="/docs">
              Browse docs
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
};
