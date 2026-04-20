# VectorStore 演进说明

本文档对应 GitHub issue #10：抽象向量层并为 Milvus 接入预留演进路径。

## 当前状态

后端已引入 `VectorStore` 协议和 `LocalVectorStore` fallback：

- `DocumentService` 负责切分文档、生成 embedding，并通过 `VectorStore.replace_document_chunks()` 写入向量索引。
- `RetrievalService` 通过 `VectorStore.search_candidates()` 获取候选 chunk，再沿用现有 hybrid scoring 和 rerank 逻辑。
- 文档详情、系统统计、重建索引判断等 chunk 读取入口已切到 `VectorStore`。
- `LocalVectorStore` 仍复用现有 JSON/SQL chunk 存储，保证当前部署不需要额外中间件。

## 接口契约

未来的 `MilvusVectorStore` 需要保持以下语义：

- `replace_document_chunks(document_id, chunks)`：删除同一文档旧 chunk，并写入新 chunk 与向量。
- `delete_document(document_id)`：删除同一文档在向量索引中的所有 chunk。
- `search_candidates(query, query_embedding, limit)`：返回可参与 hybrid rerank 的候选 chunk。
- `list_chunks_for_document(document_id)`：支撑文档详情页展示。
- `count_chunks_for_document(document_id)`、`count_embedded_chunks_for_document(document_id)`、`get_chunk_stats()`：支撑状态页、批量重建和系统统计。

## Milvus 接入路径

推荐后续分三步接入：

1. 新增配置项，例如 `AEGIS_VECTOR_STORE_PROVIDER=local|milvus`、`AEGIS_MILVUS_URI`、`AEGIS_MILVUS_COLLECTION`。
2. 新增 `MilvusVectorStore`，只替换 `deps.Container` 中的向量层装配，保持 API、`DocumentService`、`RetrievalService` 构造方式不变。
3. 为 Milvus 写集成测试或 docker compose profile，覆盖写入、搜索、删除、重建索引和 fallback 回退。

## 注意事项

- Milvus 只负责向量候选召回，不应接管业务文档元数据、用户、会话或任务状态。
- 当前 hybrid scoring 仍在 `RetrievalService` 内完成，Milvus 返回的候选集应包含足够的 chunk 文本、tokens、metadata 和 embedding 版本信息。
- 如果 Milvus 不可用，生产环境应显式失败或降级到 `LocalVectorStore`，不要静默丢索引。
