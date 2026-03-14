import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useLocation,
} from "react-router-dom";

import { Spinner } from "./components/ui/Spinner.js";
import { useCurrentUserQuery } from "./hooks/use-auth.js";
import { LoginPage } from "./pages/LoginPage.js";
import { ProtectedHomePage } from "./pages/ProtectedHomePage.js";
import { RegisterPage } from "./pages/RegisterPage.js";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      staleTime: 30_000,
    },
  },
});

const RequireAuth = () => {
  const location = useLocation();
  const currentUserQuery = useCurrentUserQuery();

  if (currentUserQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!currentUserQuery.data?.user) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return <Outlet />;
};

export const appRouter = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: "/",
        element: <ProtectedHomePage />,
      },
    ],
  },
]);

export const AppProviders = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

export const App = () => (
  <AppProviders>
    <RouterProvider router={appRouter} />
  </AppProviders>
);
