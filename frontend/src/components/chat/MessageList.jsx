function messageKey(message, index) {
  return message.id || `${message.role}-${index}`;
}

export function MessageList({ messages, citationMap }) {
  if (!messages.length) {
    return (
      <div className="empty-block">
        <strong>开始第一轮问答</strong>
        <p>上传企业文档后，在这里围绕制度、流程、产品或合规问题进行多轮对话。</p>
      </div>
    );
  }

  return (
    <div className="message-thread">
      {messages.map((message, index) => (
        <article
          key={messageKey(message, index)}
          className={message.role === "user" ? "message-card user" : "message-card assistant"}
        >
          <span className="message-role">{message.role === "user" ? "用户" : "助手"}</span>
          <p>{message.content}</p>
          {message.role === "assistant" && citationMap[message.id]?.length ? (
            <div className="citation-inline">
              {citationMap[message.id].map((item) => (
                <span key={item.chunk_id} className="citation-pill">
                  {item.display_source}
                </span>
              ))}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
