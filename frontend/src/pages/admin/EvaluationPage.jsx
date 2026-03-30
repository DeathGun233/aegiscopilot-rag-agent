import { useState } from "react";
import { fetchJson } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { useAppContext } from "../../context/AppContext";

export function EvaluationPage() {
  const { currentUserId, refreshStats, setGlobalNotice } = useAppContext();
  const [evaluation, setEvaluation] = useState(null);
  const [running, setRunning] = useState(false);

  async function handleRunEvaluation() {
    setRunning(true);
    try {
      const data = await fetchJson("/evaluate/run", {
        method: "POST",
        userId: currentUserId,
      });
      setEvaluation(data.run);
      await refreshStats();
    } catch (error) {
      setGlobalNotice(error.message || "评估执行失败");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="admin-content">
      <section className="dashboard-hero">
        <div>
          <span className="hero-pill">Evaluation</span>
          <h2>离线评估中心</h2>
          <p>使用内置测试集校验回答率、引用命中率和关键词覆盖率。</p>
        </div>
        <div className="hero-actions">
          <button type="button" className="primary-action" onClick={handleRunEvaluation} disabled={running}>
            {running ? "评估中..." : "运行评估"}
          </button>
        </div>
      </section>

      {evaluation ? (
        <>
          <section className="metric-grid">
            <article className="metric-card">
              <span>测试样例</span>
              <strong>{evaluation.cases}</strong>
            </article>
            <article className="metric-card">
              <span>回答率</span>
              <strong>{evaluation.answer_rate}</strong>
            </article>
            <article className="metric-card">
              <span>引用命中率</span>
              <strong>{evaluation.citation_hit_rate}</strong>
            </article>
            <article className="metric-card">
              <span>关键词命中率</span>
              <strong>{evaluation.keyword_hit_rate}</strong>
            </article>
          </section>

          <section className="panel-card">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">Run Detail</span>
                <h3>最近一次评估结果</h3>
              </div>
              <small>{formatDateTime(evaluation.created_at)}</small>
            </div>

            <div className="evaluation-list">
              {evaluation.details.map((item) => (
                <article key={item.case_id || item.id} className="evaluation-card">
                  <strong>{item.question}</strong>
                  <p>{item.answer}</p>
                  <small>
                    引用文档：{item.citations?.length ? item.citations.join("、") : "无"}
                  </small>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : (
        <section className="panel-card">
          <div className="table-empty">还没有评估结果，点击上方按钮运行一次评估。</div>
        </section>
      )}
    </div>
  );
}
