import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";

import { ReadinessChecksList } from "../components/workflow/ReadinessChecksList.js";
import { Alert } from "../components/ui/Alert.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Spinner } from "../components/ui/Spinner.js";
import { useRegisterMutation } from "../hooks/use-auth.js";
import {
  isSystemReadinessReady,
  useSystemReadinessQuery,
} from "../hooks/use-system-readiness.js";

type RegisterFormValues = {
  displayName: string;
  email: string;
  password: string;
};

export const RegisterPage = () => {
  const registerMutation = useRegisterMutation();
  const readinessQuery = useSystemReadinessQuery();
  const navigate = useNavigate();
  const isReady = isSystemReadinessReady(readinessQuery.data);
  const authBlocked = readinessQuery.isLoading || readinessQuery.isError || !isReady;
  const {
    formState: { errors },
    handleSubmit,
    register,
  } = useForm<RegisterFormValues>({
    defaultValues: {
      displayName: "",
      email: "",
      password: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await registerMutation.mutateAsync(values);
    navigate("/");
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
              Review the instance checks on this page. Account creation unlocks here
              once every check passes.
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
                      ? "All instance checks are green. You can create an account from this page."
                      : "Account creation stays locked until every failed check below is fixed."}
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
              Operator Setup
            </p>
            <h2 className="font-display text-[1.7rem] font-semibold tracking-[-0.02em]">Register</h2>
            <p className="text-sm text-secondary">
              Create a local account for this Quayboard instance.
            </p>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="display-name">Display name</Label>
            <Input
              id="display-name"
              autoComplete="name"
              {...register("displayName", { required: "Display name is required." })}
            />
            {errors.displayName ? (
              <Alert tone="error">{errors.displayName.message}</Alert>
            ) : null}
          </div>
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
              autoComplete="new-password"
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
          {registerMutation.error ? (
            <Alert tone="error">{registerMutation.error.message}</Alert>
          ) : null}
          {authBlocked ? (
            <Alert>
              Account creation is unavailable until the failed readiness checks are resolved.
            </Alert>
          ) : null}
          <Button className="w-full" disabled={registerMutation.isPending || authBlocked} type="submit">
            {registerMutation.isPending ? <Spinner /> : "Create account"}
          </Button>
          </form>
          <p className="mt-6 text-sm text-secondary">
            Already registered?{" "}
            <Link className="text-foreground underline decoration-accent/60 underline-offset-4 hover:decoration-accent" to="/login">
              Sign in
            </Link>
          </p>
          <p className="mt-3 text-sm text-secondary">
            Need a quick overview first?{" "}
            <Link className="text-foreground underline decoration-accent/60 underline-offset-4 hover:decoration-accent" to="/docs">
              Browse docs
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
};
