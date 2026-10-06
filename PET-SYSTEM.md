# 宠物陪玩系统 v2.1.0

本地项目增量升级，不改变 Matter 物理、角色概率、连击及计分规则。不增加联网功能或养成数值。

## 接入审计
原生 JS ES Modules、Canvas 2D、Matter.js；app.js 的 frame/advanceFrame 为主循环，mergeActors/step/award/finish 分别负责合成、危险检测、纪录和结算，canvas Pointer Events 负责投放。index.html/styles.css 为响应式布局。geometry-384-r1.json 为角色配置，assets/naiwa/384-r1/sprites 为11张既有PNG。
原图鉴 gallery() 展示全部角色，没有解锁存档。本次补齐唯一共享 Collection，图鉴和宠物都读取它。历史 rounds/lastRound 的有效最高形态迁移为1至最高等级；新玩家默认解锁LV1，实际投放、合成、继承出现的角色解锁。旧项目没有记住未结算局中看到的角色，因此这部分无法自动还原。

## 修改文件
- dist/collection.js：唯一解锁数据、旧记录迁移、ID校验。
- dist/pet-manager.js：状态机、冷却、有限事件等待、复用视图、Pointer交互。
- dist/app.js：事件发送、共享图鉴选择、存储、主循环和生命周期接入。
- dist/index.html / styles.css：游戏框外侧边陪玩平台、响应式及减少动画样式。
- package.json / tests/logic.test.mjs / tests/pet-browser.mjs：版本和验收。

状态：IDLE、LOOKING、HAPPY、EXCITED、SLEEPING、SCARED、SAD、PETTING、ANNOYED。待机4–9秒小动作，无明显事件20–40秒后有概率睡眠。瞄准采用平滑的小幅偏转。合成400ms冷却，Combo分段升级，不逐层重启；高纪录一次/局庆祝1600ms，匹配宠物角色有6秒彩蛋冷却。解锁与高Combo在强反应期间只保留有限待处理项，不堆积事件或timeout。

## 图鉴与存档
图鉴 → 角色详情 → 设为宠物；已选显示“当前宠物 ✓”，未解锁按钮禁用。默认LV1。原 readStorage/writeStorage 保存键 naiwa:independent:collection（version/unlocked）与 naiwa:independent:pet（selectedId），测试模式有 test: 命名空间。无第二套宠物解锁数据。无效ID回退LV1，清除存档后刷新恢复初始状态，其他页面清除触发storage同步。

## 互动与事件
点击随机开心、疑惑、躲闪；连续3–5次轻微不满，6+躲闪，约2秒恢复。快速20次不会创建新节点或多个定时器。摸头：从本体上部58%起按住超过350ms、累计水平移动18px，显示最多3颗心；移动12px以上不会误触点击。鼠标和触摸共用Pointer Events，取消、丢失捕获、暂停和切换清理手势。
MERGE / HIGH_LEVEL_MERGE / COMBO（包含8+高Combo）/ DROP / NEAR_GAME_OVER / GAME_OVER / NEW_HIGH_SCORE / NEW_CHARACTER_UNLOCKED 由游戏主动发送。宠物不扫描物理世界。危险一次动画后担忧静止，解除恢复；结算失落2400ms后安静，重开全部清理。普通暂停跟随游戏冻结；结算弹窗期间失落动作允许完成，隐藏页面仍冻结。

## 移动端与性能
移动端66px、桌面104px最大图片边长，PNG按原图透明裁切比例绘制一次。为宠物预留独立76/116px侧栏，缩放游戏呈现而不变动物理边界；气泡/平台透明区域不拦输入，本体独立交互。沿用四边safe-area。只有一个宠物和三个复用气泡。复用现有RAF，不创建每帧DOM；只用transform/opacity动画。减少动画时关闭跳跃和摇动，保留单个轻气泡。

## 验证与手动体验
npm run build；npm run lint；npm test。
测试包含原64项浏览器回归、9项逻辑测试、新增宠物浏览器测试（图鉴门控、选择/刷新/坏存档/清档、鼠标摸头、真实触摸和取消、暂停/重开、20次点击节点数量、320×568及四种手机/横屏布局）。浏览器截图在tests/artifacts（不提交）。
启动“启动游戏.cmd”，打开图鉴选已解锁角色；正常投放和连锁合成、超过最高分，观察反应；点击宠物、按住头部左右拖动；暂停、重开、刷新确认存档。没有真实iPhone设备验证：已检查Chromium手机尺寸与现有Safari动态视口/safe-area代码，不能等同真机Safari测试。
没有重新绘制眨眼表情，静态PNG以缩放、歪头、姿态和气泡表达；没有金币、商店、喂食、Buff或额外解锁弹窗。
