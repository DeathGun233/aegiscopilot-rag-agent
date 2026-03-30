import { Navigate, createBrowserRouter } from "react-router-dom";
import { WorkspaceShell } from "./components/layout/WorkspaceShell";
import { ChatPage } from "./pages/ChatPage";
import { AdminLayout } from "./pages/admin/AdminLayout";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { EvaluationPage } from "./pages/admin/EvaluationPage";
import { KnowledgePage } from "./pages/admin/KnowledgePage";
import { UsersPage } from "./pages/admin/UsersPage";

function withShell(element) {
  return <WorkspaceShell>{element}</WorkspaceShell>;
}

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/chat" replace />,
  },
  {
    path: "/chat",
    element: withShell(<ChatPage />),
  },
  {
    path: "/chat/:conversationId",
    element: withShell(<ChatPage />),
  },
  {
    path: "/admin",
    element: withShell(<AdminLayout />),
    children: [
      { index: true, element: <Navigate to="/admin/overview" replace /> },
      { path: "overview", element: <DashboardPage /> },
      { path: "knowledge", element: <KnowledgePage /> },
      { path: "users", element: <UsersPage /> },
      { path: "evaluation", element: <EvaluationPage /> },
    ],
  },
]);
