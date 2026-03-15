import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";

import { Alert } from "../components/ui/Alert.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Spinner } from "../components/ui/Spinner.js";
import { useLoginMutation } from "../hooks/use-auth.js";

type LoginFormValues = {
  email: string;
  password: string;
};

export const LoginPage = () => {
  const loginMutation = useLoginMutation();
  const location = useLocation();
  const navigate = useNavigate();
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
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="flex flex-col justify-between" surface="rail">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Quayboard
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Control Plane Access</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              Enter the control plane with your local account to continue project setup,
              overview review, and flow approval.
            </p>
          </div>
          <div className="grid gap-3 pt-8">
            <div className="rounded-md border border-border/80 bg-panel/76 px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Workspace model
              </p>
              <p className="mt-2 text-sm text-foreground">Project-scoped setup with gated approvals.</p>
            </div>
            <div className="rounded-md border border-border/80 bg-panel/76 px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Current milestone
              </p>
              <p className="mt-2 text-sm text-foreground">Project creation, setup, overview, and user flows.</p>
            </div>
          </div>
        </Card>
        <Card className="w-full">
          <div className="mb-6 space-y-2 border-b border-border/70 pb-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Operator Login
            </p>
            <h2 className="font-display text-3xl tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Sign in with your local account to access your Quayboard workspace.
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
          <Button className="w-full" disabled={loginMutation.isPending} type="submit">
            {loginMutation.isPending ? <Spinner /> : "Sign in"}
          </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground">
            Need an account?{" "}
            <Link className="text-foreground underline decoration-accent/60 underline-offset-4 hover:decoration-accent" to="/register">
              Register
            </Link>
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
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
