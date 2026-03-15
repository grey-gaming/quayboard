import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";

import { Alert } from "../components/ui/Alert.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { Input } from "../components/ui/Input.js";
import { Label } from "../components/ui/Label.js";
import { Spinner } from "../components/ui/Spinner.js";
import { useRegisterMutation } from "../hooks/use-auth.js";

type RegisterFormValues = {
  displayName: string;
  email: string;
  password: string;
};

export const RegisterPage = () => {
  const registerMutation = useRegisterMutation();
  const navigate = useNavigate();
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
    <main className="min-h-screen px-6 py-10">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="flex flex-col justify-between" surface="rail">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Quayboard
            </p>
            <h1 className="mt-3 font-display text-4xl tracking-tight">Create Operator Account</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">
              Create an operator account for this instance to access guided setup, overview
              generation, and user-flow approval.
            </p>
          </div>
          <div className="grid gap-3 pt-8">
            <div className="rounded-md border border-border/80 bg-panel/76 px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Access model
              </p>
              <p className="mt-2 text-sm text-foreground">Local account auth with project-scoped workflow state.</p>
            </div>
            <div className="rounded-md border border-border/80 bg-panel/76 px-4 py-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                First actions
              </p>
              <p className="mt-2 text-sm text-foreground">Check readiness, create a project, then complete setup.</p>
            </div>
          </div>
        </Card>
        <Card className="w-full">
          <div className="mb-6 space-y-2 border-b border-border/70 pb-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Operator Setup
            </p>
            <h2 className="font-display text-3xl tracking-tight">Register</h2>
            <p className="text-sm text-muted-foreground">
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
          <Button className="w-full" disabled={registerMutation.isPending} type="submit">
            {registerMutation.isPending ? <Spinner /> : "Create account"}
          </Button>
          </form>
          <p className="mt-6 text-sm text-muted-foreground">
            Already registered?{" "}
            <Link className="text-foreground underline decoration-accent/60 underline-offset-4 hover:decoration-accent" to="/login">
              Sign in
            </Link>
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
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
