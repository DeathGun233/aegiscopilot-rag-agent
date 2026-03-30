# Windows 启动排障

这份文档专门解决 Windows 下最常见的启动问题。

## 1. `.venv\\Scripts\\activate` 无法执行

常见报错：

- `PSSecurityException`
- `因为在此系统上禁止运行脚本`

原因：

PowerShell 实际执行的是 `Activate.ps1`。系统执行策略禁止脚本时，就会报错。这不代表虚拟环境坏了。

推荐做法：

直接使用虚拟环境里的 Python，不依赖 `activate`。

```powershell
cd D:\codex_create\backend
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8002
```

## 2. `npm` 无法执行

常见原因：

- 没安装 Node.js
- Node.js 没进环境变量
- `npm.ps1` 被 PowerShell 执行策略拦住

推荐做法：

直接使用 `npm.cmd`。

```powershell
cd D:\codex_create\frontend
npm.cmd install
npm.cmd run dev -- --host 0.0.0.0 --port 5177
```

检查方式：

```powershell
node -v
npm.cmd -v
```

## 3. 后端端口被占用

检查端口：

```powershell
cmd /c netstat -ano | findstr LISTENING | findstr :8002
```

结束旧进程：

```powershell
cmd /c taskkill /PID <pid> /F
```

## 4. 前端端口被占用

Vite 可能会自动切到其他端口，所以建议显式指定：

```powershell
npm.cmd run dev -- --host 0.0.0.0 --port 5177
```

## 5. 页面提示“连接模型失败”

按下面顺序检查：

1. 后端是否还活着

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8002/health
```

2. 模型目录是否正常

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8002/models
```

3. 是否已配置阿里云 API Key

项目会自动读取：

- `AEGIS_LLM_API_KEY`
- `OPEN_AI_KEY`
- `OPENAI_API_KEY`

## 6. 为什么有时命令运行很久

这通常不是程序死了，而是：

- `vite dev` 是常驻进程
- `uvicorn` 也是常驻进程
- Windows 下后台启动时，终端工具不一定立刻返回

所以“命令超时”不一定等于“服务没起来”。最可靠的是直接访问接口和页面。

## 7. 当前推荐的稳定命令

### 后端

```powershell
cd D:\codex_create\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8002
```

### 前端

```powershell
cd D:\codex_create\frontend
npm.cmd run dev -- --host 0.0.0.0 --port 5177
```

### 健康检查

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8002/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:8002/models
```
