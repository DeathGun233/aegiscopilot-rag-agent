# AegisCopilot 当前版本使用入口

这份文档对应当前已经跑通的版本，建议你优先看它，而不是旧的 README。

## 当前已实现功能

- 企业知识库问答
- 文档上传并自动抽取文本
- 文档自动建立索引
- 会话新建与删除
- 知识库文档删除
- 流式回答
- 阿里云 DashScope OpenAI 兼容 API 接入
- 前端可切换模型
- 离线评估

## 推荐启动端口

- 后端：`8002`
- 前端：`5177`

## 后端启动

```powershell
cd D:\codex_create\backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8002
```

验证：

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8002/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8002/models
```

## 前端启动

```powershell
cd D:\codex_create\frontend
npm.cmd install
npm.cmd run dev -- --host 0.0.0.0 --port 5177
```

打开：

```text
http://localhost:5177
```

## 当前支持的模型

- `qwen3-max`
- `qwen-max`
- `qwen-plus`
- `qwen-turbo`

推荐：

- 面试展示：`qwen3-max`
- 平时调试：`qwen-plus`

## 知识库使用方式

1. 进入知识库页
2. 上传 `txt`、`md`、`pdf`、`docx`
3. 等待索引完成
4. 如果上传错了，可以直接删除文档

删除文档时会同步清掉对应索引片段，避免脏数据污染知识库。

## 你最该看的文档

- [快速启动与运维手册](D:/codex_create/docs/10-quickstart-and-ops.md)
- [Windows 启动排障](D:/codex_create/docs/11-windows-startup-troubleshooting.md)
- [项目背景](D:/codex_create/docs/01-project-background.md)
- [整体架构](D:/codex_create/docs/02-architecture.md)
