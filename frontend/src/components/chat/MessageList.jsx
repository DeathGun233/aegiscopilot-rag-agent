function messageKey(message, index) {
  return message.id || `${message.role}-${index}`;
}

export function MessageList({ messages, citationMap }) {
  if (!messages.length) {
    return (
      <div className="empty-block">
        <strong>No messages yet</strong>
        <p>Upload knowledge documents first, then use this workspace for grounded multi-turn Q&amp;A.</p>
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
          <span className="message-role">{message.role === "user" ? "User" : "Assistant"}</span>
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
