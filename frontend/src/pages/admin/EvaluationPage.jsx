import { useState } from "react";
import { useAppContext } from "../../context/AppContext";

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
      setError(requestError.message || "Failed to run evaluation");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="admin-page-grid">
      <section className="content-card wide">
        <div className="card-head">
          <div>
            <span className="eyebrow">Evaluation</span>
            <h3>Offline benchmark</h3>
          </div>
          <button type="button" className="primary-action" onClick={handleRun} disabled={running}>
            {running ? "Running..." : "Run evaluation"}
          </button>
        </div>

        {error ? <div className="error-banner">{error}</div> : null}

        {evaluationRun ? (
          <>
            <section className="overview-cards">
              <article className="metric-card">
                <span>Cases</span>
                <strong>{evaluationRun.cases}</strong>
              </article>
              <article className="metric-card">
                <span>Answer rate</span>
                <strong>{evaluationRun.answer_rate}</strong>
              </article>
              <article className="metric-card">
                <span>Citation hit rate</span>
                <strong>{evaluationRun.citation_hit_rate}</strong>
              </article>
              <article className="metric-card">
                <span>Keyword hit rate</span>
                <strong>{evaluationRun.keyword_hit_rate}</strong>
              </article>
            </section>

            <div className="evaluation-list">
              {evaluationRun.details.map((item) => (
                <article key={item.case_id} className="evaluation-card">
                  <strong>{item.question}</strong>
                  <p>{item.answer}</p>
                  <div className="tag-row">
                    {item.citations.map((citation) => (
                      <span key={citation} className="tag-chip">
                        {citation}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className="empty-block">
            <strong>No evaluation result yet</strong>
            <p>Run the benchmark to inspect current answer and citation quality.</p>
          </div>
        )}
      </section>
    </div>
  );
}
