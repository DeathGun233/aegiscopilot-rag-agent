import { createContext, useContext, useEffect, useState } from "react";
import { fetchJson, uploadFile } from "../lib/api";

const AppContext = createContext(null);

function sortConversations(items) {
  return [...items].sort((left, right) => new Date(right.updated_at) - new Date(left.updated_at));
}

export function AppProvider({ children }) {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [appError, setAppError] = useState("");
  const [globalNotice, setGlobalNotice] = useState("");
  const [currentUserId, setCurrentUserId] = useState("admin");
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [modelCatalog, setModelCatalog] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [evaluationRun, setEvaluationRun] = useState(null);

  async function refreshConversations() {
    const data = await fetchJson("/conversations", { userId: currentUserId });
    const ordered = sortConversations(data.conversations);
    setConversations(ordered);
    return ordered;
  }

  async function refreshDocuments() {
    const data = await fetchJson("/documents", { userId: currentUserId });
    setDocuments(data.documents);
    return data.documents;
  }

  async function refreshStats() {
    const data = await fetchJson("/system/stats", { userId: currentUserId });
    setStats(data.stats);
    return data.stats;
  }

  async function refreshApp() {
    const [statsData, usersData, meData, modelsData] = await Promise.all([
      refreshStats(),
      fetchJson("/users", { userId: currentUserId }),
      fetchJson("/users/me", { userId: currentUserId }),
      fetchJson("/models", { userId: currentUserId }),
    ]);
    await Promise.all([refreshDocuments(), refreshConversations()]);
    setUsers(usersData.users);
    setCurrentUser(meData.user);
    setModelCatalog(modelsData.catalog);
    setStats(statsData);
    setAppError("");
  }

  useEffect(() => {
    let cancelled = false;
    setBootstrapping(true);

    refreshApp()
      .catch((error) => {
        if (!cancelled) {
          setAppError(error.message || "Failed to load application data.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBootstrapping(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  async function createConversation(title = "New conversation") {
    const data = await fetchJson("/conversations", {
      method: "POST",
      body: { title },
      userId: currentUserId,
    });
    await refreshConversations();
    await refreshStats();
    return data.conversation;
  }

  async function deleteConversation(conversationId) {
    await fetchJson(`/conversations/${conversationId}`, {
      method: "DELETE",
      userId: currentUserId,
    });
    await refreshConversations();
    await refreshStats();
  }

  async function uploadDocumentFile(file) {
    const data = await uploadFile("/documents/upload", file, currentUserId);
    await refreshDocuments();
    await refreshStats();
    return data;
  }

  async function deleteDocument(documentId) {
    await fetchJson(`/documents/${documentId}`, {
      method: "DELETE",
      userId: currentUserId,
    });
    await refreshDocuments();
    await refreshStats();
  }

  async function fetchDocument(documentId) {
    return fetchJson(`/documents/${documentId}`, { userId: currentUserId });
  }

  async function selectModel(modelId) {
    const data = await fetchJson("/models/select", {
      method: "POST",
      body: { model_id: modelId },
      userId: currentUserId,
    });
    setModelCatalog(data.catalog);
    await refreshStats();
    return data.catalog;
  }

  async function runEvaluation() {
    const data = await fetchJson("/evaluate/run", {
      method: "POST",
      userId: currentUserId,
    });
    setEvaluationRun(data.run);
    await refreshStats();
    await refreshConversations();
    return data.run;
  }

  return (
    <AppContext.Provider
      value={{
        appError,
        bootstrapping,
        conversations,
        createConversation,
        currentUser,
        currentUserId,
        deleteConversation,
        deleteDocument,
        documents,
        evaluationRun,
        fetchDocument,
        globalNotice,
        modelCatalog,
        refreshApp,
        refreshConversations,
        refreshDocuments,
        refreshStats,
        runEvaluation,
        selectModel,
        setCurrentUserId,
        setGlobalNotice,
        stats,
        uploadDocumentFile,
        users,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const value = useContext(AppContext);
  if (!value) {
    throw new Error("useAppContext must be used inside AppProvider");
  }
  return value;
}
