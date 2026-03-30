export function ChatComposer({
  query,
  onQueryChange,
  onSubmit,
  isStreaming,
  streamStatus,
  starterPrompts,
}) {
  return (
    <form className="chat-composer" onSubmit={onSubmit}>
      <textarea
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="输入一个基于知识库的问题，例如：生产发布前需要准备什么？"
        rows={4}
      />

      <div className="composer-foot">
        <div className="starter-list">
          {starterPrompts.map((item) => (
            <button key={item} type="button" className="starter-chip" onClick={() => onQueryChange(item)}>
              {item}
            </button>
          ))}
        </div>

        <button type="submit" className="primary-action" disabled={isStreaming}>
          {isStreaming ? "生成中..." : "发送"}
        </button>
      </div>

      {streamStatus ? <p className="stream-label">{streamStatus}</p> : null}
    </form>
  );
}
