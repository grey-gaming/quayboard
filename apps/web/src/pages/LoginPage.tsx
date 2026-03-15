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
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <div className="mb-6 space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Quayboard
          </p>
          <h1 className="font-display text-3xl tracking-tight">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Authenticate with your M1 local account to access the protected API shell.
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
          <Link className="text-accent hover:underline" to="/register">
            Register
          </Link>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Prefer the product guide first?{" "}
          <Link className="text-accent hover:underline" to="/docs">
            Browse docs
          </Link>
        </p>
      </Card>
    </main>
  );
};
