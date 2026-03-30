import { useMemo, useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { formatDateTime, truncate } from "../../lib/format";

function sourceLabel(document) {
  const mapping = {
    upload: "上传文件",
    seed: "示例文档",
    text: "手动录入",
    pdf: "PDF",
    docx: "Word",
    markdown: "Markdown",
  };
  return mapping[document.source_type] || document.source_type;
}

export function KnowledgePage() {
  const { currentUser, deleteDocument, documents, fetchDocument, setGlobalNotice, uploadDocumentFile } =
    useAppContext();
  const [keyword, setKeyword] = useState("");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [busy, setBusy] = useState(false);

  const visibleDocuments = useMemo(() => {
    const needle = keyword.trim().toLowerCase();
    if (!needle) {
      return documents;
    }
    return documents.filter((document) =>
      [document.title, document.department, document.source_type, ...(document.tags || [])]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [documents, keyword]);

  async function handleSelectDocument(documentId) {
    setSelectedDocumentId(documentId);
    try {
      const detail = await fetchDocument(documentId);
      setSelectedDetail(detail);
    } catch (error) {
      setGlobalNotice(error.message || "文档详情加载失败");
    }
  }

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setBusy(true);
    setGlobalNotice(`正在解析并录入 ${file.name} ...`);
    try {
      const result = await uploadDocumentFile(file);
      setGlobalNotice(`已录入 ${result.document.title}，新增 ${result.chunks_created} 个片段。`);
    } catch (error) {
      setGlobalNotice(error.message || "文档上传失败");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function handleDelete(documentId) {
    try {
      await deleteDocument(documentId);
      if (selectedDocumentId === documentId) {
        setSelectedDocumentId("");
        setSelectedDetail(null);
      }
      setGlobalNotice("文档已从知识库删除。");
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
          <p>统一处理文档上传、索引查看、错误文档删除和片段预览。</p>
        </div>

        <div className="hero-actions">
          <label className="primary-action upload-button">
            上传文档
            <input
              type="file"
              accept=".txt,.md,.markdown,.pdf,.docx"
              onChange={handleUpload}
              hidden
              disabled={currentUser?.role !== "admin" || busy}
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
              placeholder="搜索标题、部门、来源或标签"
            />
          </div>

          <div className="data-table">
            <div className="data-table-head">
              <span>文档</span>
              <span>部门</span>
              <span>来源</span>
              <span>状态</span>
              <span>操作</span>
            </div>

            {visibleDocuments.length ? (
              visibleDocuments.map((document) => (
                <article
                  key={document.id}
                  className={selectedDocumentId === document.id ? "data-row active" : "data-row"}
                  onClick={() => handleSelectDocument(document.id)}
                >
                  <div>
                    <strong>{document.title}</strong>
                    <small>{truncate(document.content_preview || "", 72)}</small>
                  </div>
                  <span>{document.department}</span>
                  <span>{sourceLabel(document)}</span>
                  <span className={document.indexed ? "state-badge indexed" : "state-badge pending"}>
                    {document.indexed ? `已索引 · ${document.chunk_count || 0} 片段` : "未索引"}
                  </span>
                  <button
                    type="button"
                    className="danger-text"
                    disabled={currentUser?.role !== "admin"}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDelete(document.id);
                    }}
                  >
                    删除
                  </button>
                </article>
              ))
            ) : (
              <div className="table-empty">没有匹配的文档，可以尝试更换关键词。</div>
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

          {selectedDetail ? (
            <div className="detail-stack">
              <div className="detail-block">
                <strong>{selectedDetail.document.title}</strong>
                <p>
                  {selectedDetail.document.department} · {sourceLabel(selectedDetail.document)}
                </p>
                <small>
                  {selectedDetail.document.indexed
                    ? `已索引 · ${selectedDetail.document.chunk_count || 0} 个片段 · ${formatDateTime(
                        selectedDetail.document.indexed_at,
                      )}`
                    : "尚未建立索引"}
                </small>
              </div>

              <div className="detail-block">
                <span>内容预览</span>
                <p>{truncate(selectedDetail.document.content || "", 320)}</p>
              </div>

              <div className="detail-block">
                <span>片段预览</span>
                <div className="chunk-list">
                  {selectedDetail.chunks.length ? (
                    selectedDetail.chunks.map((chunk) => (
                      <article key={chunk.id} className="chunk-card">
                        <strong>片段 {chunk.chunk_index + 1}</strong>
                        <p>{chunk.text_preview}</p>
                      </article>
                    ))
                  ) : (
                    <p>当前没有可展示的片段。</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="table-empty">点击左侧文档查看详情和片段。</div>
          )}
        </aside>
      </section>
    </div>
  );
}
