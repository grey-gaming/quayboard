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
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <Card className="w-full max-w-md">
        <div className="mb-6 space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Quayboard
          </p>
          <h1 className="font-display text-3xl tracking-tight">Register</h1>
          <p className="text-sm text-muted-foreground">
            Create the local account used by the M1 auth foundation.
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
          <Link className="text-accent hover:underline" to="/login">
            Sign in
          </Link>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Need a quick overview first?{" "}
          <Link className="text-accent hover:underline" to="/docs">
            Browse docs
          </Link>
        </p>
      </Card>
    </main>
  );
};
