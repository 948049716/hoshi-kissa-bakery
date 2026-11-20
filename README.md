# 星夜吃茶：喵呜甜品合合乐 (Hoshi Kissa: Starlight Patisserie)

本仓库为 **微信小游戏原生 Canvas 2D 版本** 工程（已移除旧版 H5 工程与单文件 HTML 构建）。

## 目录结构

- `05-微信小游戏版本/`：微信小游戏主工程（[使用与导入说明](05-微信小游戏版本/README.md)）
- `01-游戏效果图/`：效果图与物理碰撞预览图
- `02-游戏素材-精修透明PNG/`：去背精修 PNG 主素材与 `physics_shapes.json`
- `03-游戏素材-原始原图与WebP/`：原始合图与底图归档
- `scripts/`：素材处理、物理轮廓提取、小游戏无头端到端回归测试（`node scripts/verify_minigame_e2e.mjs`）及微信自动上传脚本（`node scripts/upload_minigame.mjs`）
- `.github/workflows/minigame-ci.yml`：GitHub Actions 自动验证并上传微信小游戏工作流
- `游戏设计与玩法说明书.md`：完整玩法数值、系统与美术规格文档

## 自动上传微信开发者平台 (GitHub Actions CI)

每次推送到 `main` 分支（或手动在 GitHub Actions 点击 **Run workflow**），都会先运行完整 E2E 检查，再通过官方 `miniprogram-ci` 自动上传至微信开发者平台（版本号默认 `1.0.<run_number>`）：

1. 登录 [微信公众平台](https://mp.weixin.qq.com/) → **开发管理** → **开发设置** → **小程序代码上传**：
   - 生成并下载 **小程序代码上传密钥**（`.key` 文件内容）
   - 将 **代码上传 IP 白名单** 关闭（GitHub Actions 云端运行机出口 IP 不固定）
2. 打开本 GitHub 仓库 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**：
   - `WECHAT_PRIVATE_KEY`：完整粘贴 `.key` 私钥文本内容（包含 `-----BEGIN RSA PRIVATE KEY-----` 到结尾）
   - `WECHAT_APPID`（可选）：如未设置，默认读取 `05-微信小游戏版本/project.config.json` 中的 `appid`（当前为 `wx923bf8440b65a1af`）


