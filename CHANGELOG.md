# Changelog

本项目的所有重要版本变更均记录于此文档。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本 2.0.0](https://semver.org/lang/zh-CN/) 及 [docs/版本管理与发布规范.md](./docs/版本管理与发布规范.md)。

---

## [0.13.0] - 2026-11-25（玩法大改造 M4 · 远程调参 / 激励视频 / We分析 / 开放域好友榜 / 星夜设置与无障碍）

### Added（M4 · 平台能力与收口打磨）
- **远程调参热修（`cloudfunctions/kissa_sync/index.js`、`src/platform.js`、`src/game_app.js`）**：云函数新增 `action: 'config'` 读取 `db.collection('config').doc('balance')` 并过滤清洗数值与 `features` 开关（无文档时安全回退默认空覆盖）；客户端启动时同步加载本地缓存 `__hoshi_remote_cfg_v1__` 并后台异步刷新，统一经 `BalanceConfig.applyRemoteOverrides()` 白名单夹逼生效。
- **激励视频三触点（`BalanceConfig.ADS`、`platform.showRewardedVideoAd`）**：
  - **失败复活加时**：结算失败页提供「视频加时 +15秒」（每局严格限 1 次，无尽模式回滚当班累计防双计，主线防重复发放安慰尘）；
  - **结算双倍星尘**：通关获星尘后提供「视频双倍 +N」（每日上限 3 次，持久化于 `hoshi_ad_double_v1`）；
  - **无尽词条刷新**：`perk_pick` 弹窗底部提供「观看视频刷新加成」（每班限 1 次）；
  - 预留正式占位 `adUnitId: 'adunit-placeholder-hoshi-reward'`，未看完视频不发奖并弹出温和提示。
- **We分析 完整埋点补齐**：在 `level_start / level_end / mode_start` 基础上补齐 `shop_buy`、`tutorial_step` 与 `ad_reward` 三类自定义事件上报（经 `platform.reportEvent` 蛇形键与类型清洗）。
- **微信开放数据域好友榜（`openDataContext/index.js`、`game.json`）**：注册 `openDataContext` 目录，纯 Canvas 2D（零外部素材、零 `hsl()`、零原生 Emoji）按 `totalStars` / `totalScore` 同构 KV 渲染微信好友排行；主域排行榜「好友榜」分页在微信环境直接贴图渲染，非微信环境展示「已接入开放域」预览卡与「邀请好友一起玩」分享入口。
- **星夜设置弹窗与无障碍增强（`src/modals_ui.js`、`src/screens_ui.js`、`src/ui_draw.js`、`src/board_renderer.js`）**：大厅左上角新增对称木质圆钮「设」（暂停弹窗同步增设「设置」入口），集成 5 项独立开关（背景音乐 / 操作音效 / 震动开关 / 节能轻量 / 色觉角标）并持久化至存档 `v3.settings`；开启「节能轻量」跳过环境星尘与外框光斑粒子，开启「色觉角标」在烤盘猫饼与顾客气泡风味角标叠加高对比度 `茶 / 莓 / 金` 圆形字标。
- **测试与验证**：`test_v2_core.mjs` 新增 `UT-M12 ~ UT-M14`（共 **73** 项核心单测）；`e2e_tier4.mjs` 新增 `T4-14`（全量 **227** 条 4-Tier 端到端用例通过）；`.github/workflows/deploy-wechat-minigame.yml` 纳入 `openDataContext/*.js` 语法检查。

### Changed（M4）
- `GAME_VERSION` 升级至 **`0.13.0`**，`BALANCE_VERSION` 升级至 **`0.13.0-m4`**。

---

## [0.12.0] - 2026-11-25（玩法大改造 M3 · 方向 D 顾客特性 / 18 张流派加成 / 每天特调 / 无限营业 / 茶研所 & 存档 v3）

### Added（M3 · 方向 D）
- **8 位动物顾客专属特性（`src/customer_traits.js`，`FEATURES.traits`）**：奶糖布偶猫「温柔」、焦糖橘猫大叔「大食」、银渐层书生猫「抹茶迷」、奶油垂耳兔「莓好」、栗子小浣熊「回礼」（单局限 1 次赠厨具）、蓝莓小柴犬「急性子」（`≥60%` 耐心 `×1.15`）、焦糖小狐狸「好评」（全员耐心 `+15%`）、星冠美食家白猫「品鉴」（整单热乎 `×1.30`）；气泡左上角渲染圆形特性徽章，星夜图鉴新增第 3 分页「顾客图鉴」。
- **18 张数据驱动流派加成与修饰器编译器（`src/perks_data.js`、`src/run_modifiers.js`）**：8 基础 / 6 精选 / 4 传说（12 张默认入池 + 6 张由茶研所解锁），覆盖暖炉、扩盘、急单、厨余、耐心、面粉、连击、备用厨具、自动染色、满盘欢赞、双倍热气、暴击星火、热潮盛宴、永续热潮、猫神护福、点石成金与星冠加持。
- **每天特调（`FEATURES.daily`，`1-5` 解锁）**：基于 UTC+8 日期（`YYYYMMDD`）跨端确定性生成盘面（12 套轮换）、发牌种子与 2 条当日特调规则；当日首通 `+15 ⭐`、满 3 星 `+15 ⭐`（同日防重复领取），支持全服「特调榜」。
- **无限营业（`FEATURES.endless`，`1-10` 解锁）**：每班 `60s`、目标分按 `round(1800 × 1.32^(n-1))` 递增，每 3 班触发 VIP 专场；过班弹出「挑选本局加成」3 选 1 弹窗持续构筑流派；每过 1 班奖 `2 ⭐`（每日上限 `60 ⭐`），支持全服「无限榜」。
- **星夜茶研所（小铺第 5 分页 `shop_tab_research`）**：独立星尘上限 `RESEARCH_TOTAL_CAP = 2,000 ⭐`（**保持原有 `5,650 ⭐` 小铺定价 100% 不变**），包含 6 张流派星牌、2 册顾客手记与 3 枚台面徽章。
- **大厅 5 键底栏 & 排行榜 5 页签**：大厅新增「挑战」入口弹窗，排行榜扩展至「总星榜 / 营业榜 / 特调榜 / 无限榜 / 好友榜」，全部文案通过 `kissa_round.ttf` 零缺字审计。
- **测试与验证**：`test_v2_core.mjs` 新增 `UT-T01..08 / UT-P01..18 / UT-D01 / UT-S05 / UT-S06 / UT-M11`（共 **70** 项单测）；`e2e_tier4.mjs` 新增 `T4-11 ~ T4-13`（共 **226** 条 4-Tier E2E）。

### Changed（M3）
- `GAME_VERSION` 升级至 **`0.12.0`**，`BALANCE_VERSION` 升级至 **`0.12.0-m3`**。
- 存档升级至 **`schemaVersion = 3`**（`src/save_sync.js`、`cloudfunctions/kissa_sync/index.js`、`src/platform.js`）：支持 `v2 → v3` 无损自动升级（不误触 `v1` 礼金），增量新增 `modeStats / researchUnlocks / levelGoalsDone / seenTips / settings`，保留 4 键 `seenTutorials` 与高版本（`> 3`）防覆盖写保护；云端与本地同步新增 `RESEARCH_COSTS` 100% 同构校验与每日/无尽模式反作弊及榜单排名字段。

---

## [0.11.0] - 2026-11-25（玩法大改造 M2 · 方向 C 关卡节奏 / 目标 / 事件 / 结算诊断）

### Added（M2 · 方向 C）
- **2 种全新程序化盘格**：
  - **星炉格 `O`（`oven`，2-4 首秀）**：未冰封 `< C5` 猫饼停满 `6.0s` 自动升 1 阶（封顶 `C5`）并打热乎戳 `bakedAt`，配套铜炉格栅、星火与烘烤进度环（严格 `0` 分）。
  - **蜜糖格 `S`（`syrup`，3-2 首秀）**：滑入猫饼停驻定位（同阶可合并），原位猫饼可正常滑离，配套焦糖漩涡与高光滴珠绘制。
- **7 种关卡目标状态机（`src/level_goals.js`，`FEATURES.goals`）**：`score / ice_clear / centerpiece / serve_count / combo / hot_serve / limited_knead`，覆盖 30 关中的 14 关目标关；未达标强制 `0★`，达标按分评星；支持 `earlyClose` 满星提前打烊奖励（`round(timeLeft × 40 × chFactor)`，单局封顶 `20,000`，归入结算单独校验不污染上菜分）。
- **5 种局内随机事件（`src/level_events.js`，`FEATURES.events`）**：美食家巡店（下一单场面 `+0.50`）、原料特价（5 次揉面必出 `C2`）、热风烤盘（8s 热乎时间翻倍）、冰霜降临（3s 预警后随机冻住 2 块优先 `≤ C5`）、外卖快送（限时 `0.7×` 耐心 / `1.4×` 赏金）；按 `events` 种子流在 25%~75% 时段确定性调度 1~3 个，顶部独立横幅 + 倒计时环 + `audio.playEvent / playGoalDone / playOvenDing`。
- **新低阶草莓菜谱 `R25 草莓小爪碟`**：单件 `C3` 草莓（基础价 `188`），`2-1` 解锁（总菜谱增至 **25** 道）。
- **结算诊断（`src/run_diagnostics.js`）**：结算弹窗展示「暴击 / 热乎率 / 热潮」本局亮点与 1 条可执行改进建议。
- **测试与门禁**：`test_v2_core.mjs` 新增 `UT-G19~G20 / UT-L01~L07 / UT-E01~E05 / L2-7 / UT-M10`（共 **64** 项单测）；`sim_balance.mjs` 新增 `L2-8` 目标可达率 `≥ 65%` 门禁；`e2e_tier3.mjs` 新增 `T3-21`（全量 **223** 条 4-Tier E2E）。

### Changed（M2）
- `GAME_VERSION` 升级至 **`0.11.0`**，`BALANCE_VERSION` 升级至 **`0.11.0-m2`**。
- **第 1 章机制出场前置重排**：`1-4` 抹茶 `M` 首秀（`R15` 解锁同步提前至 `1-4`）、`1-6` 镀金 `G` 首秀、`1-8` 冰封 `I` 首秀；第 2 章 `2-1` 草莓 `B` + `R25` 首秀、`2-4` 星炉 `O` 首秀；第 3 章 `3-2` 蜜糖 `S` 首秀。
- 云函数 `cloudfunctions/kissa_sync/index.js` 新增 `earlyCloseBonus <= 20000` 校验。
- 全 30 关星级经模拟器重新定标，保持商店价格与星尘经济不变。

---

## [0.10.0] - 2026-11-25（玩法大改造 M0 基建 + M1 核心循环 A/B）

### Added（M1 · 方向 A 搓饼与上菜联动 + 方向 B 星光狂欢 V2）
- **烘焙暴击（`FEATURES.bakeCrit`）**：单次滑动同时合出 `≥ 2` 颗 `C3+` 触发「双重烘焙！/三重烘焙！/星光暴击！」（热潮 `+8/+15/+25`、搭档技能 `+6%/+10%/+15%`，3 连最高新饼镀金，4 连镀金 + 升 1 阶；**严格 0 分**）；配套金色扩散环、微震屏、叠层风铃音效（`audio.playCrit`）与短震动。
- **面团温度（`src/dough_temp.js`，`FEATURES.doughTemp`）**：揉面升温 `+22°`、指数+线性冷却；金色温区（`40~99°`）`C2` 概率 `+15%` 且连揉 6 次保底 `C3`（风味关优先落抹茶/草莓）；过热（`≥ 100°`）本次出 `C1` 并锁定 `1.2s`（连败 `≥ 2` 次缩短为 `0.6s`），解锁回落 `50°`；揉面按钮下方显示冷蓝→适温金→过热红温度条并切换「过热中」文案，配套 `audio.playOverheat`。
- **出炉新鲜度（`FEATURES.freshBonus`）**：合成产出的 `C2+` 猫饼记录 `bakedAt`，`6s` 内端给顾客单品品质区 `×1.15` 并显示盘面热气与托盘热乎火点；订单全部可合成项热乎额外 `+6` 热潮能量。
- **星光热潮 V2（`FEATURES.feverV2`）**：场面区加成调整为 `+20%`；热潮中支持同滑最多 `3` 轮连锁合成、「热潮揉面」（`70% C2 / 30% C3` 且冻结面团温度）、上菜延时 `+1s`（单次上限 `+4s`）、结束「热潮余温」全盘非冰封 `C1 → C2` 与星空色调覆层。
- **一次性轻量引导**：`bake_crit / fresh / dough_temp / fever_v2` 4 条首触提示；全部新增文案均在现有 `kissa_round.ttf` 字库内零缺字。
- **单测与 E2E**：新增 `UT-G16~G18 / UT-K01~K03 / UT-O14 / UT-F01~F02 / UT-M09`（共 58 项核心单测）与 `T3-19 / T3-20` 端到端用例；CI（`minigame-ci.yml`）新增 `sim_balance.mjs --check --seeds 6` 数值门禁。

### Changed（M1）
- `GAME_VERSION` 升级至 **`0.10.0`**，`BALANCE_VERSION` 升级至 **`0.10.0-m1`**。
- 使用 `scripts/sim_balance.mjs`（人类节奏三档 Bot × 12 seeds × 30 关）重新定标全 30 关星级门槛，解决原 `v0.9.0` 第 2/3 章门槛偏陡与第 1 章偏平问题；保持各星尘奖励与商店价格不变。

### Added（M0 · 基建与数值体系，已合入）
- `src/rng.js`：mulberry32 种子 RNG + 网格/顾客/事件分流，`startLevel(id, { seed })` 全局可复现（每日特调/回放/模拟器基础）。
- `src/game_events.js`：局内同步事件总线（`run:start / slide / knead / crit / serve / fever:start / fever:end / run:end` …），监听器异常隔离。
- `src/balance_config.js`：v0.10+ 数值单一来源、`FEATURES` 特性开关、远程调参白名单夹逼 `applyRemoteOverrides()`。
- `scripts/sim_balance.mjs` + `scripts/lib/headless_app.mjs`：无头驱动真实控制器的三档 Bot 数值模拟器（分布报告 / 建议星级 / `--write` 定标 / `--check` 门禁）。
- `platform.reportEvent`（We分析）与 `runReport.telemetry` 局内统计埋点；`docs/07-数值模拟与调参手册.md`。
- 单测 `UT-R01 / UT-O11 / UT-O12 / UT-O13 / UT-E00`。

### Changed（M0）
- **计分改为乘区制**：技巧区相加封顶 +0.90、场面区相加封顶 +1.00、顾客区相乘；旧连乘公式保留在 `FEATURES.scoreZones=false`。
- **`modeOverrides` 全链路生效**：上菜计分、C2 概率、搭档技能、开局厨具、关卡形状/星级覆盖统一走 run context；非 `campaign` 模式不写存档、不推云、不触发连败保底。
- 包体门禁由 3.2 MB 上调至 **3.5 MB**（T1-F01-06 / UT-M01 / L3-8 与文档同步）；修正文档中残留的「自动上菜」描述与计分过期注释。

### Removed
- 彻底清理 `v0.9.0` 全量绘本 UI 资产替换后已完全废弃的旧素材目录与旧切图脚本：`02-游戏素材-精修透明PNG/`（78 个文件，约 `5.30 MB`）、`03-游戏素材-原始原图与WebP/`（17 个文件，约 `6.68 MB`）、`scripts/extract_assets.py` 与 `scripts/extract_ui_assets.py`。

### Changed
- 更新 `scripts/test_v2_core.mjs`（`inferSpriteDims` 对齐 `v0.9.0` 尺寸、`UT-M01` 新增上述 4 项清理路径零残留断言）与 `scripts/e2e_tier2.mjs`（清理过时常量、补充 `T2-F01-04` 零残留检查并修正 `T2-F01-06` 标题文案）。
- 同步更新 `.gitignore`、`README.md`、`05-微信小游戏版本/README.md`、`PROJECT.md`、`docs/04-美术与音频素材制作规范.md`、`docs/05-技术架构重构与代码改造方案.md` 与 `docs/HANDOVER.md`。

---

## [0.9.0] - 2026-11-24

### Changed
- **产品版本号归正**：`GAME_VERSION` 将正式设定为 `'0.9.0'`，CI 自动构建版本号规则由 `1.0.<run_number>` 改为跟随主次版本 `<MAJOR>.<MINOR>.<run_number>`。
- **局外经济与星尘收支重平衡**：
  - 新档初始星尘调整为 `15 ⭐`（原 `30 ⭐`）；
  - 猫饼研发菜价单级增幅由 `+20%` 收敛为 `+15%`（满级 `1.60×`），并启用 `unlockLevel` 渐进解锁门控；
  - 吃茶小铺全满级动态总上限调整为 `SHOP_TOTAL_CAP = 5,650 ⭐`（前 3 章 90 星满产约 `~3,150 ⭐`，达成 `~56%` 毕业度，预留 `~2,500 ⭐` 承接后续 `v1.1.0+` 新章节）；
  - 收紧章节首星突破奖与过关基础奖，新增**同星级纯重刷星尘折半衰减**。
- **局内得分乘区与 30 关星级校准**：收敛风味（`1.25×`）、镀金（`1.35×`）、套餐（`1.00/1.12/1.25`）、绿红条耐心（`1.20×/0.80×`）、`8.0s` 连击（封顶 `1.28×`）与热潮（`1.25×`），全 30 关目标分梯次拉宽至 `1.00 : 1.45 : 1.95`。
- **厨余篮加入冷却与浪费惩罚（`TRASH_CONFIG`）**：双击/右滑丢弃托盘猫饼后进入 `8.0s` 整理冷却，同时中断上菜连击并扣减 `15` 热潮能量（已有营业分绝不扣减）。
- **重塑叉子为「挑拣移位叉」（`applyForkAction`）**：支持单点破冰、跨障挪移并触发 `G/M/B` 染色、异阶（或双 `C7`）互换、同阶跨格合并破邻冰，以及选中猫饼后直接点击【厨余篮】无视冷却销毁的极端残局零死锁保底；应急购价调为 `20 ⭐`（魔法勺 `25 ⭐`）。
- **长线扩展与防护加固**：
  - 单关连败 `>= 2` 次开局赠送 `40%` 初始搭档技能充能软保底；
  - 动态派生 `MAX_CAMPAIGN_STARS` 与小铺/图鉴自适应滚动列表；
  - 新增 `higherSchemaDetected` 高版本云存档防覆盖写保护、`modeOverrides` 模式解耦桩位、激励桩位 `requestRewardAction` 及客户端↔云函数常量 100% 同构单测门禁。
- **全量绘本 UI、圆体字体与过渡动效重构（严格对齐 13 张 `v0.9.0` 设计定稿图）**：
  - **原画设计图无损替换**：删除 `01-游戏效果图/` 旧版 8 张草图，无损替换为 13 张 `768×1376` 原画定稿图并新增索引文档 [`01-游戏效果图/README.md`](./01-游戏效果图/README.md)；启动默认**直达选关大厅**，保留 `01_标题首屏_TitleScreen（备用）.jpg`、`title_hero_v2.jpg` 及 `renderTitleScreen()` 作为备用首屏。
  - **69 张微信白名单纯 ASCII PNG/JPG 资产与 4 枚补充素材**：因微信小游戏代码包白名单不包含 `.webp` 且 iOS 需避免中文资源路径，将 65 张官方切图与严格同风格补充生成的 4 枚徽章（`icon_avatar_default`、`icon_urgent_flame`、`icon_fever_badge`、`icon_cloud_sync`）统一压制为纯 ASCII 路径的 **65 PNG + 4 JPG**（`assets/ui_v090/<id>.(png|jpg)`，总计 `1.41 MB`），并在 `scripts/upload_minigame.mjs` 新增上传前白名单/ASCII 校验与上传后 `__FULL__` 包体防漏校验（编译后整包约 `2.3 MB`，远低于微信 `4.0 MB` 限额）。
  - **圆体子集字体管线与 iOS 真机适配**：新增 `scripts/build_font_subset.py`，由 SIL OFL 1.1 `ResourceHanRoundedCN-Bold.ttf` 裁剪生成 `367.7 KB`（体积缩减 `97.3%`）的 `assets/fonts/kissa_round.ttf`，统一 Windows/Mac 名称表为无空格 `KissaRound`（`Regular` 标记保留粗圆体字形），并在 `src/ui_v090_skin_patch.js` 中适配 iOS 微信 Canvas 2D 整数像素单一字体名格式（`${px}px KissaRound`），全面升级全站暖木框、羊皮纸、雨棚、分段进度条、滑块开关与无黑遮罩暖木厨余冷却格。
  - **全界面与 8 大弹窗精细还原**：全面重做大厅 3 章手绘地图、局内吧台/托盘/热潮条、关卡备战、打烊结算、星夜小铺（4 页签 + 烤盘主题实景缩略图）、星夜图鉴（3 列网格 + 底部详情条）、猫饼排行榜（3 页签：默认`全服总星榜` + `累计营业榜` + `微信好友榜[正在开发中]`，全面应用金/银/铜牌与渐变行底色）、暂停开关弹窗及 4 卡插图玩法说明。
  - **丝滑 UI 过渡动画**：加入弹窗春弹入场与遮罩淡入、页签切换淡入微滑、章节切换背景交叉淡化、3D 按钮按压厚边下陷、暂停滑块平滑滑动、推进关猫爪跳动与结算星级阶梯弹入/分数滚动计数。

---

## [0.8.0] - 2026-11-24

> 注：此版本为原核心玩法大重构基线（此前内部文档曾误标为 `v2.0`，现已按上线前 SemVer 规范统一归正为 `v0.8.0`）。

### Added
- **异形盘格 2048 + 3 席实时出餐核心玩法**：落地纯逻辑引擎 `grid_engine.js`、`order_service.js`、`levels_data.js` 与渲染层 `board_renderer.js`。
- **7 阶纯猫造型「猫饼」与风味体系**：实现 `C1~C7`、4 种烘焙风味（`plain` / `matcha` / `berry` / `gold`）、特殊格染色（`G/M/B`）、木质障碍柱（`X`）、缺角虚空（`#`）与正交 4 邻接破冰（`I`）。
- **3 大章节 × 30 关战役地图与外围系统**：上线选关地图、4 页签吃茶小铺、双页图鉴、3 位主厨搭档新技能、2 枚应急厨具与 6 步非阻塞聚光灯新手引导。
- **Schema v2 云同步与全服双榜**：实现 `migrateV1ToV2` 老存档无损退还星尘迁移及 `kissa_sync` 总星数进度榜 / 累计营业榜。
- **全量自动化测试套件**：落地 `scripts/test_v2_core.mjs` 与 220 条 4-Tier 无头 Chromium E2E 回归套件（`scripts/verify_minigame_e2e.mjs`）。

### Removed
- 彻底移除早期物理玻璃罐引擎与废弃资源（`physics.js`、`physics_shapes.js`、`jar_renderer.js`、旧 `tier_1~9*` 贴图及旧版 90 秒狂欢 / 悠闲经典模式）。

---

## [0.4.0] - 早期原型归档（原误标 `4.0`）

### Added
- 完成 5 幕肉鸽弹珠炉物理原型与 16 张秘方构筑设计方案，现归档于 [docs/archive/v0.4.0-早期5幕弹珠炉原型策划案.md](./docs/archive/v0.4.0-早期5幕弹珠炉原型策划案.md)。

---

## [0.3.0] - 早期原型归档（原误标 `3.0`）

### Added
- 完成微信小游戏原生 Canvas 2D 首版搭建与玻璃罐三模式（主厨/狂欢/经典）规格设计，现归档于 [docs/archive/v0.3.0-早期玻璃罐三模式原型规格书.md](./docs/archive/v0.3.0-早期玻璃罐三模式原型规格书.md)。
