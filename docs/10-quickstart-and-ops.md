# 快速启动与运维手册

这份文档对应当前已经实现的版本，重点讲如何启动、如何验证、如何日常使用。

## 一、当前版本包含什么

当前项目已经具备：

- 企业知识库文档上传
- 自动文本抽取与索引
- 对话式问答
- 流式回答
- 模型切换
- 会话管理
- 知识库文档删除
- 离线评估

## 二、推荐启动端口

- 后端：`8002`
- 前端：`5177`

如果端口冲突，可以自行换端口，但需要保证前端请求地址和后端地址一致。

## 三、后端启动

```powershell
cd D:\codex_create\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8002
```

启动后先验证：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8002/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8002/models
```

正常时你会看到：

- `provider: openai-compatible`
- 当前模型，例如 `qwen3-max`

## 四、前端启动

```powershell
cd D:\codex_create\frontend
npm.cmd install
npm.cmd run dev -- --host 0.0.0.0 --port 5177
```

浏览器访问：

```text
http://localhost:5177
```

## 五、首次使用建议

1. 进入知识库页
2. 上传 `pdf`、`docx`、`md` 或 `txt`
3. 等待索引完成
4. 在顶部切换想使用的模型
5. 新建一个对话
6. 开始提问

## 六、知识库治理

### 上传文档

支持：

- `txt`
- `md`
- `markdown`
- `pdf`
- `docx`

后端会自动抽取文本并建立 chunk。

### 删除文档

如果上传错文档，或者文档内容不该进入知识库，现在可以直接删除。

删除后会清理：

- 文档记录
- 对应 chunk
- 后续检索结果中的相关内容

这一步很重要，因为真实业务里知识库一定会遇到脏数据治理问题。

## 七、模型切换

当前前端支持切换：

- `qwen3-max`
- `qwen-max`
- `qwen-plus`
- `qwen-turbo`

推荐策略：

- 面试演示：`qwen3-max`
- 平时开发调试：`qwen-plus`
- 追求速度：`qwen-turbo`

模型选择会被持久化，重启后仍然保留。

持久化文件：

```text
backend/storage/runtime_model.json
```

## 八、接口清单

### 系统

- `GET /health`
- `GET /system/stats`
- `GET /models`
- `POST /models/select`

### 会话

- `GET /conversations`
- `POST /conversations`
- `GET /conversations/{conversation_id}`
- `DELETE /conversations/{conversation_id}`

### 知识库

- `GET /documents`
- `POST /documents`
- `POST /documents/upload`
- `POST /documents/index`
- `DELETE /documents/{document_id}`

### 问答

- `POST /chat`
- `POST /chat/stream`

### 评估

- `POST /evaluate/run`
- `GET /tasks/{task_id}`

## 九、如何验证改动是否生效

### 验证模型切换

1. 打开前端
2. 顶部切换模型
3. 查看顶部统计卡片中的 `llm_model`
4. 调用 `GET /models`，确认 `active_model` 已变化

### 验证知识库删除

1. 上传一个测试文档
2. 在知识库页点击删除
3. 刷新列表
4. 再次提问，确认答案不再引用该文档

## 十、面试展示建议

推荐展示顺序：

1. 说明这是企业知识库 AIAgent，不是简单聊天机器人
2. 展示文档上传和自动抽取
3. 展示模型切换
4. 展示流式回答
5. 展示会话管理
6. 展示知识库删除，说明数据治理能力
7. 展示离线评估，说明工程完整性

## 十一、后续可继续增强的点

- 多知识库隔离
- 权限控制
- 向量数据库接入
- rerank
- 更细的文档解析策略
- LangGraph 工作流可视化
