# 升级审查与验收（v2.0.0）

## 现有结构

Vanilla JavaScript ES Modules + Canvas 2D + Matter.js。无 Phaser/PixiJS 框架、无打包器、无运行时 npm 依赖。`dist` 本身是静态网站源与发布目录。

- 主循环：app.js 的 frame → advanceFrame → step（requestAnimationFrame，120Hz 固定步长）。
- 生成、投放：spawn / drop / clampAim。
- 碰撞：collisionStart / collisionActive → impactFeedback / queuePairs。
- 合成：resolveMerges → mergeActors，actors Map 和 locked 防重复；移除后不再参与匹配。
- 得分：mergeScore（round-rules.js）→ award；最高分即刻保存。
- 结束：step 的警戒线倒计时 → finish → settleRound；reset 清理物理和视觉队列。
- UI：index.html / styles.css；分数滚轮在 score-counter.js；本机榜单与意见在 community.js。
- 音频：现有 WebAudio 音频函数，复用并强化，未为形式新增 AudioManager。
- 输入：现有 Pointer Events 与键盘事件；此次移除触摸长按自动投放与重复 touch 监听。
- 边界：rebuildWalls，fitStage 只改变 Canvas 展示，物理世界不随 resize 重建。

原项目已有 combo、倍率、粒子、WebAudio、Pointer Events、localStorage、ResizeObserver。此次保留现有模块与主循环，只新增 effects.js 提供可独立验证的视觉曲线。

## 卡墙证据和修复

修复前：左侧 6 级角色以 0.7 弧度旋转出生后，一部分实际轮廓跨入左墙；模拟约 1.2 秒后停在 y≈296，速度接近零，仍悬在半空。

原因：spawn 只按图像中心设置位置，旋转后没有对实际凸多边形轮廓做统一边界约束；角色 friction≈0.5 / frictionStatic=0.7，墙面 friction=0.65，使初始穿透容易进入黏滞接触。墙原本 50px 厚，步长已经固定，resize 原本也没有重建墙，这些不是此复现场景的主要原因。

修复：出生时按真实顶点统一 containBirth；合成定位同样读真实顶点而非包含速度预测的 bounds。左右墙改为 60px 厚、低摩擦，地面单独保留摩擦；角色静摩擦降低。positionIterations=10、velocityIterations=8、constraintIterations=2，保留 120Hz 固定步长与每帧 50ms 的时间夹取。

兜底：仅当真实轮廓穿墙 >0.6px、速度 <0.12、离地面至少 12px，并持续 1000ms，才向内修正 2–5px，一只角色每局最多一次，记录诊断。没有每帧强制回场。

调试默认关闭；访问 `?debugPhysics=1` 可查看轮廓、墙体、速度、接触点。`?test=1` 才暴露确定性测试工具。

## 动画、计分和音频

合成旧角色以视觉快照压缩约 80ms，再用约 90ms 吸附。物理替换原子完成，快照不参与碰撞。新角色约 280ms 按 0.55 → 1.18 → 0.94 → 1.04 → 1.0 弹性出生。减少动画模式改为淡出和 0.96 → 1.0。

初始 combo=0、倍率=1；每次合成先加一层和 0.25 倍，再计分。第一次合成为 1.25 倍，四层为 2 倍，基本倍率上限 5 倍。2.2 秒无合成后逐层衰减；每再过 2.2 秒减一层和 0.25 倍，最低 1 倍。基本得分 `round(2^新等级 × 5 × 倍率)`。保留原本双倍狂欢（倍率最多 10）、高阶清场、30/80 等自动配对奖励和下一局继承；倍速仍统一缩放游戏时间。

合成粒子通常 8–16 个，生命周期 300–650ms。普通粒子最多 90、奖励粒子最多 60，总计最多 150；碎片最多 60，shockwave 最多 30。低核数或连续慢帧降低数量，减少动画模式普通合成仅 2 个淡粒子、无震屏。

WebAudio 只在用户触摸/点击/键盘操作后初始化。全部声音由振荡器即时合成，无需下载、复制或预加载外部音频。音量通过主 Gain 保存，静音按钮保留。

- drop：成功投放才触发。
- landing：碰撞法向相对速度 >=1.6，单角色 120ms 接触反馈冷却，全局 80ms 实际时间音频冷却；轻微接触不出声。
- merge：一次成功合成触发一次。
- combo：偶数层且 >=2；highCombo：偶数层且 >=8；配合额外轻音，不逐帧触发。
- gameOver：自然满场时柔和三音；它可在结算对话框中完成，静音、隐藏页面或重开会取消。

音高随机 ±4%，落地音量/音高随强度变化，最多 20 个声音节点。普通合成不震屏；7–8 级 2.5px/75ms，9–11 级 4.5px/110ms；特殊奖励局部脉冲不超过 3px/100ms，HUD 不移动。

## 移动端与验证范围

保留正确 viewport，100svh/100dvh 和 visualViewport/innerHeight fallback，四边 safe-area；触控按钮至少 44×44px。游戏区域单独 touch-action:none / 禁选择 / 禁拖拽，表单和对话框滚动保持原生。Pointer Capture 处理滑出区域，取消/失去捕获不投放，多指不重复投放。横屏可玩，附竖屏更佳提示。

已通过 5 项纯逻辑测试和 64 项 Edge/Chromium 浏览器检查，包括 12 次连续物理合成、同时/连锁合成、旋转角色两侧贴墙、贴墙合成、resize、1000ms 低 FPS 帧夹取、粒子清理、暂停、静音、音量、自然结束、重开、刷新最高分、真实浏览器触摸释放/取消/快速连续触摸、减少动画。

布局测量覆盖 375×667、390×844、393×852、430×932、844×390；分数与连击不重叠，游戏区完整显示，所有主要触控目标达到 44px。

限制：未连接真实 iPhone，未实测 WebKit/Safari 和普通手机持续 60fps；安全区公式已检查，但刘海/动态岛/地址栏必须在真机上最终确认。GitHub Pages 工作流已提供，但尚未在你的 GitHub 仓库执行。线上私有版本通过 Sites 单独发布。

检查命令：`npm run build`、`npm run lint`、`npm test`。测试截图与结果在 tests/artifacts（忽略提交）。Playwright 优先使用项目安装包，当前电脑可以使用 Codex 自带包；其他电脑可通过 PLAYWRIGHT_MODULE_PATH 指定包位置，或安装 Playwright 并准备 Chromium/Chrome/Edge。

