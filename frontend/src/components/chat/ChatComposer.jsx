export function ChatComposer({
  query,
  onQueryChange,
  onSubmit,
  isStreaming,
  streamStatus,
  starterPrompts,
}) {
  return (
    <form className="hero-composer" onSubmit={onSubmit}>
      <textarea
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Ask a document-grounded question, for example: 生产发布前需要准备什么？"
        rows={5}
      />
      <div className="composer-toolbar">
        <div className="prompt-row">
          {starterPrompts.map((item) => (
            <button key={item} type="button" className="prompt-chip" onClick={() => onQueryChange(item)}>
              {item}
            </button>
          ))}
        </div>
        <button type="submit" className="send-button" disabled={isStreaming}>
          {isStreaming ? "Generating..." : "Send"}
        </button>
      </div>
      {streamStatus ? <p className="stream-text">{streamStatus}</p> : null}
    </form>
  );
}
