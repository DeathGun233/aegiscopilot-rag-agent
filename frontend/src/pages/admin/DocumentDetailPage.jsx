import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
  return mapping[document?.source_type] || document?.source_type || "-";
}

export function DocumentDetailPage() {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { deleteDocument, fetchDocument, setGlobalNotice } = useAppContext();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      setLoading(true);
      setError("");
      try {
        const data = await fetchDocument(documentId);
        if (!cancelled) {
          setDetail(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message || "文档加载失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [documentId, fetchDocument]);

  async function handleDelete() {
    try {
      await deleteDocument(documentId);
      setGlobalNotice("文档已从知识库删除。");
      navigate("/admin/knowledge", { replace: true });
    } catch (deleteError) {
      setGlobalNotice(deleteError.message || "文档删除失败");
    }
  }

  return (
    <div className="admin-content">
      <section className="dashboard-hero">
        <div>
          <span className="hero-pill">文档详情</span>
          <h2>{detail?.document?.title || "正在加载文档"}</h2>
          <p>查看原始内容和 chunk 拆分结果，辅助排查检索效果。</p>
        </div>

        <div className="hero-actions">
          <Link className="secondary-action" to="/admin/knowledge">
            返回列表
          </Link>
          <button type="button" className="danger-outline" onClick={handleDelete} disabled={!detail}>
            删除文档
          </button>
        </div>
      </section>

      {loading ? <section className="panel-card table-empty">正在加载文档详情...</section> : null}
      {error ? <section className="panel-card table-empty">{error}</section> : null}

      {detail ? (
        <section className="admin-grid two-columns">
          <article className="panel-card">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">元数据</span>
                <h3>文档信息</h3>
              </div>
            </div>

            <div className="definition-list">
              <div>
                <span>部门</span>
                <strong>{detail.document.department}</strong>
              </div>
              <div>
                <span>来源</span>
                <strong>{sourceLabel(detail.document)}</strong>
              </div>
              <div>
                <span>状态</span>
                <strong>{detail.document.indexed ? "已索引" : "待索引"}</strong>
              </div>
              <div>
                <span>索引时间</span>
                <strong>{detail.document.indexed_at ? formatDateTime(detail.document.indexed_at) : "-"}</strong>
              </div>
              <div>
                <span>版本</span>
                <strong>{detail.document.version}</strong>
              </div>
              <div>
                <span>标签</span>
                <strong>{detail.document.tags?.join(", ") || "-"}</strong>
              </div>
            </div>

            <div className="detail-block">
              <span>原始内容预览</span>
              <p>{truncate(detail.document.content || "", 800)}</p>
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">片段</span>
                <h3>Chunk 拆分</h3>
              </div>
            </div>

            <div className="chunk-list">
              {detail.chunks.length ? (
                detail.chunks.map((chunk) => (
                  <article key={chunk.id} className="chunk-card">
                    <strong>片段 {chunk.chunk_index + 1}</strong>
                    <small>{chunk.token_count} 个 token</small>
                    <p>{chunk.text_preview}</p>
                  </article>
                ))
              ) : (
                <div className="table-empty">当前文档尚未建立索引。</div>
              )}
            </div>
          </article>
        </section>
      ) : null}
    </div>
  );
}
