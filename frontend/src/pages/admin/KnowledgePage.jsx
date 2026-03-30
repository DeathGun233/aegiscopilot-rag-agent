import { useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../../context/AppContext";

function sourceLabel(document) {
  const mapping = {
    upload: "Upload",
    seed: "Seed",
    text: "Manual",
    pdf: "PDF",
    docx: "Word",
    markdown: "Markdown",
  };
  return mapping[document.source_type] || document.source_type;
}

export function KnowledgePage() {
  const { currentUser, deleteDocument, documents, setGlobalNotice, uploadDocumentFile } = useAppContext();
  const [keyword, setKeyword] = useState("");
  const [busy, setBusy] = useState(false);

  const visibleDocuments = documents.filter((document) => {
    if (!keyword.trim()) {
      return true;
    }
    const haystack = [document.title, document.department, document.source_type, ...(document.tags || [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(keyword.trim().toLowerCase());
  });

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    setBusy(true);
    setGlobalNotice(`Parsing and indexing ${file.name} ...`);
    try {
      const result = await uploadDocumentFile(file);
      setGlobalNotice(`Imported ${result.document.title} with ${result.chunks_created} new chunks.`);
    } catch (error) {
      setGlobalNotice(error.message || "Upload failed");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function handleDelete(documentId) {
    try {
      await deleteDocument(documentId);
      setGlobalNotice("Document removed from the knowledge base.");
    } catch (error) {
      setGlobalNotice(error.message || "Delete failed");
    }
  }

  return (
    <div className="admin-page-grid">
      <section className="content-card wide">
        <div className="card-head">
          <div>
            <span className="eyebrow">Knowledge Base</span>
            <h3>Documents and index</h3>
          </div>
          <label className="primary-action">
            Upload document
            <input
              type="file"
              accept=".txt,.md,.markdown,.pdf,.docx"
              onChange={handleUpload}
              hidden
              disabled={currentUser?.role !== "admin" || busy}
            />
          </label>
        </div>

        <label className="search-field">
          <span>Search documents</span>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="Search by title, department, source, or tags"
          />
        </label>

        <div className="document-table">
          <div className="document-table-head">
            <span>Document</span>
            <span>Department</span>
            <span>Source</span>
            <span>Index</span>
            <span>Actions</span>
          </div>

          {visibleDocuments.length ? (
            visibleDocuments.map((document) => (
              <article key={document.id} className="document-row">
                <div>
                  <Link to={`/admin/knowledge/${document.id}`} className="document-link">
                    {document.title}
                  </Link>
                  <p>{document.content_preview || "No preview available."}</p>
                </div>
                <span>{document.department}</span>
                <span>{sourceLabel(document)}</span>
                <span>{document.chunk_count || 0} chunks</span>
                <div className="row-actions">
                  <Link to={`/admin/knowledge/${document.id}`} className="inline-link">
                    View
                  </Link>
                  <button
                    type="button"
                    className="danger-text"
                    disabled={currentUser?.role !== "admin"}
                    onClick={() => handleDelete(document.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-block">
              <strong>No matching document</strong>
              <p>Change the filter or upload a new file.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
