import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import {
  Navigate,
  Outlet,
  RouterProvider,
  createBrowserRouter,
  useLocation,
} from "react-router-dom";

import { OverviewApprovalGate } from "./components/layout/OverviewApprovalGate.js";
import { ProductSpecApprovalGate } from "./components/layout/ProductSpecApprovalGate.js";
import { SetupCompletionGate } from "./components/layout/SetupCompletionGate.js";
import { TechnicalSpecApprovalGate } from "./components/layout/TechnicalSpecApprovalGate.js";
import { UserFlowsApprovalGate } from "./components/layout/UserFlowsApprovalGate.js";
import { UxSpecApprovalGate } from "./components/layout/UxSpecApprovalGate.js";
import { Spinner } from "./components/ui/Spinner.js";
import { useCurrentUserQuery } from "./hooks/use-auth.js";
import { DeleteProjectPage } from "./pages/DeleteProjectPage.js";
import { DevelopContextPacksDebugPage } from "./pages/DevelopContextPacksDebugPage.js";
import { DevelopPage } from "./pages/DevelopPage.js";
import { DocsArticlePage } from "./pages/DocsArticlePage.js";
import { FeatureEditorPage } from "./pages/FeatureEditorPage.js";
import { DocsHomePage } from "./pages/DocsHomePage.js";
import { ExecutionSettingsPage } from "./pages/ExecutionSettingsPage.js";
import { FeatureBuilderPage } from "./pages/FeatureBuilderPage.js";
import { ImportStubPage } from "./pages/ImportStubPage.js";
import { InstanceReadinessPage } from "./pages/InstanceReadinessPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { MilestonesPage } from "./pages/MilestonesPage.js";
import { MissionControlPage } from "./pages/MissionControlPage.js";
import { NewProjectPage } from "./pages/NewProjectPage.js";
import { OnePagerOverviewPage } from "./pages/OnePagerOverviewPage.js";
import { OnePagerQuestionsPage } from "./pages/OnePagerQuestionsPage.js";
import { ProductSpecPage } from "./pages/ProductSpecPage.js";
import { ProjectSetupPage } from "./pages/ProjectSetupPage.js";
import { ProjectReviewPage } from "./pages/ProjectReviewPage.js";
import { ProtectedHomePage } from "./pages/ProtectedHomePage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { SettingsPage } from "./pages/SettingsPage.js";
import { WorkflowSettingsPage } from "./pages/WorkflowSettingsPage.js";
import { TechnicalSpecPage } from "./pages/TechnicalSpecPage.js";
import { UxSpecPage } from "./pages/UxSpecPage.js";
import { UserFlowsPage } from "./pages/UserFlowsPage.js";

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

export const ScrollToTopOnNavigation = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return null;
};

const AppShell = () => (
  <>
    <ScrollToTopOnNavigation />
    <Outlet />
  </>
);

export const appRouter = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      {
        path: "/docs",
        element: <DocsHomePage />,
      },
      {
        path: "/docs/:slug",
        element: <DocsArticlePage />,
      },
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
          {
            path: "/setup/instance",
            element: <InstanceReadinessPage />,
          },
          {
            path: "/projects/new",
            element: <NewProjectPage />,
          },
          {
            path: "/settings",
            element: <SettingsPage />,
          },
          {
            path: "/settings/workflow",
            element: <WorkflowSettingsPage />,
          },
          {
            path: "/settings/execution",
            element: <ExecutionSettingsPage />,
          },
          {
            path: "/projects/:id",
            element: <MissionControlPage />,
          },
          {
            path: "/projects/:id/settings",
            element: <ProjectSetupPage />,
          },
          {
            path: "/projects/:id/settings/delete",
            element: <DeleteProjectPage />,
          },
          {
            path: "/projects/:id/setup",
            element: <Navigate replace to="../settings" />,
          },
          {
            element: <SetupCompletionGate />,
            children: [
              {
                path: "/projects/:id/questions",
                element: <OnePagerQuestionsPage />,
              },
              {
                path: "/projects/:id/one-pager",
                element: <OnePagerOverviewPage />,
              },
              {
                path: "/projects/:id/import",
                element: <ImportStubPage />,
              },
              {
                element: <OverviewApprovalGate />,
                children: [
                  {
                    path: "/projects/:id/product-spec",
                    element: <ProductSpecPage />,
                  },
                ],
              },
              {
                element: <ProductSpecApprovalGate />,
                children: [
                  {
                    path: "/projects/:id/ux-spec",
                    element: <UxSpecPage />,
                  },
                  {
                    element: <UxSpecApprovalGate />,
                    children: [
                      {
                        path: "/projects/:id/technical-spec",
                        element: <TechnicalSpecPage />,
                      },
                      {
                        element: <TechnicalSpecApprovalGate />,
                        children: [
                          {
                            path: "/projects/:id/user-flows",
                            element: <UserFlowsPage />,
                          },
                          {
                            element: <UserFlowsApprovalGate />,
                            children: [
                              {
                                path: "/projects/:id/milestones",
                                element: <MilestonesPage />,
                              },
                              {
                                path: "/projects/:id/features",
                                element: <FeatureBuilderPage />,
                              },
                              {
                                path: "/projects/:id/features/:featureId",
                                element: <FeatureEditorPage />,
                              },
                              {
                                path: "/projects/:id/features/:featureId/:tab",
                                element: <FeatureEditorPage />,
                              },
                              {
                                path: "/projects/:id/develop",
                                element: <DevelopPage />,
                              },
                              {
                                path: "/projects/:id/develop/review",
                                element: <ProjectReviewPage />,
                              },
                              {
                                path: "/projects/:id/develop/debug",
                                element: <DevelopContextPacksDebugPage />,
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
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
