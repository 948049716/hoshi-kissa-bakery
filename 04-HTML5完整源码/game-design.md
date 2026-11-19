# 星夜吃茶：喵呜甜品合合乐 (Hoshi Kissa: Starlight Patisserie)

## 1. 游戏概述
- **类型**：2D Q弹物理合成 × 心愿订单策略休闲游戏
- **平台**：纯 HTML5 / Canvas / Vanilla CSS / Web Audio API（提供模块化源码与单文件离线打包版 `dist/hoshi-kissa-bakery.html`）
- **美术风格**：日系手绘水彩绘本风（暖木屋、星月夜窗、暖色灯串、圆润粗描边 Q 版甜点）

## 2. 目录结构
- `index.html`：主页面与弹窗结构（标题选关、图鉴、结算总结、物理轮廓检视开关）
- `styles.css`：木质菜单板与羊皮纸质感 UI 样式（兼容桌面三栏与移动端竖屏）
- `audio.js`：纯 Web Audio API 五声音阶合成音、分级材质碰撞音效、气泡声与八音盒 BGM 引擎
- `physics_shapes.js` / `assets/processed/physics_shapes.json`：由 9 阶甜品透明 Alpha 轮廓自动提取的复合凸多边形网格、真实质心 `(com_x, com_y)` 与转动惯量系数
- `physics.js`：自研 2D 复合凸多边形刚体物理引擎（SAT 分离轴 + 2 点接触流形裁剪、PGS 顺序冲量求解器、接触力臂扭矩 `r × J`、库仑摩擦锥、圆底玻璃罐凸域精确解析碰撞与多边形扫掠落点预测）
- `game.js`：游戏主循环、定向法线软体挤压动画、接触点糖霜碎屑粒子、心愿订单系统、狂热机制与魔法厨具系统
- `assets/raw/` 与 `assets/processed/`：AI 原始生图与精修透明 PNG/WebP 素材
- `scripts/extract_assets.py`：泛洪去背、色晕净化与无缝背景合成管线
- `scripts/extract_physics_shapes.py`：透明轮廓复合凸分解、平底托盘保护、质心与转动惯量提取脚本
- `scripts/build_standalone.py`：一键内联打包为单文件离线 HTML (`dist/hoshi-kissa-bakery.html`)
- `scripts/verify_e2e.mjs`：无头 Chromium CDP 端到端实测脚本（含复合多边形与接触点截屏验证）

## 3. 操作说明
- **移动/拖动**：控制落点水平位置（支持鼠标、触屏及键盘 `←` / `→` / `A` / `D`），移动时附带自然摆动惯性
- **`Q` / `E` 或鼠标滚轮**：微调投放倾角（`±45°`），落点虚影实时显示精确多边形轮廓
- **点击/松手/空格/回车**：投下当前甜品
- **`H` / `Shift` 或点击 HOLD 框**：交换暂存口袋中的甜品
- **`1` / `2` / `3` 或点击底部圆木徽章**：使用【星铃轻摇】【泡泡小叉】【星尘魔法勺】
- **`P` 或点击顶部【📐 物理轮廓】按钮**：随时开关实时物理碰撞体、质心与接触法线视图
