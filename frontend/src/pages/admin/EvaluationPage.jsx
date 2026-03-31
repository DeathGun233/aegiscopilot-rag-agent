import { useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { formatDateTime } from "../../lib/format";

export function EvaluationPage() {
  const { evaluationRun, runEvaluation } = useAppContext();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  async function handleRun() {
    setRunning(true);
    setError("");
    try {
      await runEvaluation();
    } catch (requestError) {
      setError(requestError.message || "评估运行失败");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="admin-content">
      <section className="dashboard-hero">
        <div>
          <span className="hero-pill">离线评估</span>
          <h2>离线评估中心</h2>
          <p>使用内置测试集观察当前回答率、引用命中率和知识覆盖效果。</p>
        </div>

        <div className="hero-actions">
          <button type="button" className="primary-action" onClick={handleRun} disabled={running}>
            {running ? "评估中..." : "运行评估"}
          </button>
        </div>
      </section>

      {error ? <div className="global-notice">{error}</div> : null}

      {evaluationRun ? (
        <>
          <section className="metric-grid">
            <article className="metric-card">
              <span>测试样例</span>
              <strong>{evaluationRun.cases}</strong>
            </article>
            <article className="metric-card">
              <span>回答率</span>
              <strong>{evaluationRun.answer_rate}</strong>
            </article>
            <article className="metric-card">
              <span>引用命中率</span>
              <strong>{evaluationRun.citation_hit_rate}</strong>
            </article>
            <article className="metric-card">
              <span>关键词命中率</span>
              <strong>{evaluationRun.keyword_hit_rate}</strong>
            </article>
          </section>

          <section className="panel-card">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">运行详情</span>
                <h3>最近一次评估</h3>
              </div>
              <small>{formatDateTime(evaluationRun.created_at)}</small>
            </div>

            <div className="evaluation-list">
              {evaluationRun.details.map((item) => (
                <article key={item.case_id} className="evaluation-card">
                  <strong>{item.question}</strong>
                  <p>{item.answer}</p>
                  <small>引用文档：{item.citations?.length ? item.citations.join("、") : "无"}</small>
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
