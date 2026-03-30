# Windows 虚拟环境与 PowerShell 问题排查

## 你看到的报错是什么意思

当你在 PowerShell 中执行：

```powershell
.venv\Scripts\activate
```

PowerShell 实际上会去运行 `Activate.ps1`。如果系统执行策略禁止本地脚本执行，就会出现：

- `因为在此系统上禁止运行脚本`
- `PSSecurityException`

这不是虚拟环境损坏，而是 PowerShell 的执行策略限制。

## 推荐解决方式

不依赖 `activate`，直接使用虚拟环境里的 Python：

```powershell
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

## 项目内置脚本

为了避免 PowerShell 执行策略问题，项目提供了两个 Windows 脚本：

```powershell
.\setup.cmd
.\run-api.cmd
```

作用分别是：

- `setup.cmd`：创建 `.venv` 并安装依赖
- `run-api.cmd`：直接用 `.venv` 里的 Python 启动 FastAPI

## 如果你仍然想用 activate

可以只在当前 PowerShell 会话里临时放开脚本执行：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

这只是临时放开当前终端，不会永久修改系统策略。
