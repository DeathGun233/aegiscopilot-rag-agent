# RAG 设计与优化

## 文档处理

- 当前 MVP 支持手动录入文本和上传 UTF-8 文本文件
- 文档进入系统后会先做文本清洗，再按固定长度与 overlap 切分
- 每个 chunk 保存来源文档、部门、版本和标签等元数据

## 检索流程

- 先把 query 分词
- 对 chunk 做 token overlap 计算
- 综合命中数和词密度得到分数
- 返回 top-k 结果并生成引用信息

## 推荐升级路线

1. 接入 `bge-m3` 或 `text-embedding-3-large`
2. 用 `FAISS` 或 `pgvector` 保存向量
3. 增加 BM25 与向量混合召回
4. 用重排模型提升 top-k 质量
5. 记录召回命中率、MRR、引用准确率
