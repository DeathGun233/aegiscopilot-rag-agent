import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "../../lib/api";
import { formatDateTime, truncate } from "../../lib/format";
import { useAppContext } from "../../context/AppContext";

export function KnowledgePage() {
  const { currentUserId, isAdmin, refreshStats, setGlobalNotice } = useAppContext();
  const [documents, setDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [detail, setDetail] = useState(null);
  const [keyword, setKeyword] = useState("");
  const [department, setDepartment] = useState("all");
  const [indexState, setIndexState] = useState("all");
  const [loading, setLoading] = useState(true);

  async function loadDocuments() {
    setLoading(true);
    const data = await fetchJson("/documents", { userId: currentUserId });
    setDocuments(data.documents);
    setLoading(false);
  }

  useEffect(() => {
    loadDocuments().catch((error) => {
      setGlobalNotice(error.message || "知识库加载失败");
      setLoading(false);
    });
  }, [currentUserId]);

  useEffect(() => {
    if (!selectedDocument) {
      setDetail(null);
      return;
    }
    fetchJson(`/documents/${selectedDocument}`, { userId: currentUserId })
      .then((data) => setDetail(data))
      .catch((error) => setGlobalNotice(error.message || "文档详情加载失败"));
  }, [currentUserId, selectedDocument]);

  const departmentOptions = useMemo(
    () => ["all", ...new Set(documents.map((item) => item.department).filter(Boolean))],
    [documents],
  );

  const filteredDocuments = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    return documents.filter((document) => {
      if (department !== "all" && document.department !== department) {
        return false;
      }
      if (indexState === "indexed" && !document.indexed) {
        return false;
      }
      if (indexState === "pending" && document.indexed) {
        return false;
      }
      if (!needle) {
        return true;
      }
      return [document.title, document.department, document.source_type, document.content_preview]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [department, documents, indexState, keyword]);

  async function handleUploadDocument(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      await fetchJson("/documents/upload", {
        method: "POST",
        body: formData,
        userId: currentUserId,
      });
      setGlobalNotice(`文档已录入知识库：${file.name}`);
      await loadDocuments();
      await refreshStats();
    } catch (error) {
      setGlobalNotice(error.message || "文档上传失败");
    } finally {
      event.target.value = "";
    }
  }

  async function handleDeleteDocument(documentId) {
    try {
      await fetchJson(`/documents/${documentId}`, {
        method: "DELETE",
        userId: currentUserId,
      });
      setGlobalNotice("文档已删除");
      if (selectedDocument === documentId) {
        setSelectedDocument(null);
      }
      await loadDocuments();
      await refreshStats();
    } catch (error) {
      setGlobalNotice(error.message || "文档删除失败");
    }
  }

  return (
    <div className="admin-content">
      <section className="dashboard-hero knowledge-hero">
        <div>
          <span className="hero-pill">Knowledge Base</span>
          <h2>知识库管理</h2>
          <p>在后台统一完成文档上传、删除、索引查看与片段检查。</p>
        </div>

        <div className="hero-actions">
          <label className="primary-action upload-button">
            上传文档
            <input
              type="file"
              accept=".txt,.md,.markdown,.pdf,.docx"
              onChange={handleUploadDocument}
              hidden
              disabled={!isAdmin}
            />
          </label>
        </div>
      </section>

      <section className="admin-grid knowledge-layout">
        <article className="panel-card">
          <div className="filter-bar">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索标题、部门或内容"
            />
            <select value={department} onChange={(event) => setDepartment(event.target.value)}>
              {departmentOptions.map((item) => (
                <option key={item} value={item}>
                  {item === "all" ? "全部部门" : item}
                </option>
              ))}
            </select>
            <select value={indexState} onChange={(event) => setIndexState(event.target.value)}>
              <option value="all">全部状态</option>
              <option value="indexed">已索引</option>
              <option value="pending">未索引</option>
            </select>
          </div>

          <div className="data-table">
            <div className="data-table-head">
              <span>文档</span>
              <span>部门</span>
              <span>状态</span>
              <span>来源</span>
              <span>操作</span>
            </div>

            {loading ? (
              <div className="table-empty">正在加载知识库...</div>
            ) : filteredDocuments.length ? (
              filteredDocuments.map((document) => (
                <article
                  key={document.id}
                  className={
                    selectedDocument === document.id ? "data-row active" : "data-row"
                  }
                  onClick={() => setSelectedDocument(document.id)}
                >
                  <div>
                    <strong>{document.title}</strong>
                    <small>{formatDateTime(document.indexed_at || document.created_at)}</small>
                  </div>
                  <span>{document.department}</span>
                  <span className={document.indexed ? "state-badge indexed" : "state-badge pending"}>
                    {document.indexed ? "已索引" : "未索引"}
                  </span>
                  <span>{document.source_type}</span>
                  <button
                    type="button"
                    className="danger-text"
                    disabled={!isAdmin}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeleteDocument(document.id);
                    }}
                  >
                    删除
                  </button>
                </article>
              ))
            ) : (
              <div className="table-empty">没有匹配的知识文档。</div>
            )}
          </div>
        </article>

        <aside className="panel-card detail-panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">Document Detail</span>
              <h3>文档详情</h3>
            </div>
          </div>

          {detail ? (
            <div className="detail-stack">
              <div className="detail-block">
                <strong>{detail.document.title}</strong>
                <p>{detail.document.source_label}</p>
                <small>{detail.document.indexed_label || "未索引"}</small>
              </div>

              <div className="detail-block">
                <span>内容预览</span>
                <p>{truncate(detail.document.content_preview || detail.document.content, 240)}</p>
              </div>

              <div className="detail-block">
                <span>片段列表</span>
                <div className="chunk-list">
                  {detail.chunks.length ? (
                    detail.chunks.map((chunk) => (
                      <article key={chunk.id} className="chunk-card">
                        <strong>片段 {chunk.chunk_index + 1}</strong>
                        <p>{chunk.text_preview}</p>
                      </article>
                    ))
                  ) : (
                    <p>当前文档还没有 chunk 详情。</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="table-empty">点击左侧文档查看详情和索引片段。</div>
          )}
        </aside>
      </section>
    </div>
  );
}
