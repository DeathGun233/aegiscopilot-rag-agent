import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";
import { truncate } from "../../lib/format";

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
  const navigate = useNavigate();
  const { deleteDocument, documents, setGlobalNotice, uploadDocumentFile } = useAppContext();
  const [keyword, setKeyword] = useState("");
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

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setBusy(true);
    setGlobalNotice(`正在导入 ${file.name}...`);
    try {
      const result = await uploadDocumentFile(file);
      setGlobalNotice(`已导入 ${result.document.title}，新增 ${result.chunks_created} 个片段。`);
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
      setGlobalNotice("文档已从知识库删除。");
    } catch (error) {
      setGlobalNotice(error.message || "文档删除失败");
    }
  }

  return (
    <div className="admin-content">
      <section className="dashboard-hero knowledge-hero">
        <div>
          <span className="hero-pill">知识库</span>
          <h2>知识管理</h2>
          <p>支持上传文档、查看索引结果，并进入详情页检查 chunk 拆分情况。</p>
        </div>

        <div className="hero-actions">
          <label className="primary-action upload-button">
            上传文档
            <input type="file" accept=".txt,.md,.markdown,.pdf,.docx" onChange={handleUpload} hidden disabled={busy} />
          </label>
        </div>
      </section>

      <section className="panel-card">
        <div className="filter-bar filter-bar--single">
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="按标题、部门、来源或标签搜索"
          />
        </div>

        <div className="data-table">
          <div className="data-table-head data-table-head--knowledge">
            <span>文档</span>
            <span>部门</span>
            <span>来源</span>
            <span>状态</span>
            <span>操作</span>
          </div>

          {visibleDocuments.length ? (
            visibleDocuments.map((document) => (
              <article key={document.id} className="data-row data-row--knowledge">
                <div>
                  <strong>{document.title}</strong>
                  <small>{truncate(document.content_preview || "", 72)}</small>
                </div>
                <span>{document.department}</span>
                <span>{sourceLabel(document)}</span>
                <span className={document.indexed ? "state-badge indexed" : "state-badge pending"}>
                  {document.indexed ? `已索引 / ${document.chunk_count || 0} 个片段` : "待索引"}
                </span>
                <div className="inline-actions">
                  <button type="button" className="text-link" onClick={() => navigate(`/admin/knowledge/${document.id}`)}>
                    详情
                  </button>
                  <button type="button" className="danger-text" onClick={() => handleDelete(document.id)}>
                    删除
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="table-empty">当前筛选条件下没有匹配的文档。</div>
          )}
        </div>
      </section>
    </div>
  );
}
