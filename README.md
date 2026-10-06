# 合成奶蛙

按用户提供的 https://rtpi-ltc.github.io/MergeNaiWa/ 公开网页建立独立可运行复现。保留其游戏脚本、11 级素材、轮廓数据及动画；不是从零重写或原创素材。原站未找到可核验的公开仓库和许可证，原代码及素材的权利归原作者/各素材权利人，未授予新的许可。

## 启动

在此目录运行 `npm start`，访问 http://127.0.0.1:4173 。也可运行 `启动游戏.cmd`。需要 Node.js，不能直接双击 HTML（模块及轮廓需要 HTTP）。所有运行资源已保存本地。

## 独立修改

- 排行榜改为此浏览器的本机榜单，不连接原站服务。
- 反馈保存到本机并导出文字文件。
- 本地存储使用独立命名空间。
- 保留十一阶轮廓物理、连击、清场、双倍狂欢、继承、倍速、图鉴、暂停、声音、键盘和触摸操作。

## 素材来源

角色 PNG：参考站 `assets/naiwa/384-r1/sprites/`；动画：`animations/classic-laugh.webp`；轮廓：`geometry-384-r1.json`；图标和 Barlow Condensed 字体：参考站对应目录。Matter.js 物理引擎为随参考站分发的版本，文件保留其许可头。

## v2.0.0 手感与移动体验升级

在现有结构上增量优化，没有再从参考站获取代码或美术/音频。Q 弹合成、碰撞声、音量、奶油 UI、触摸松手投放、出生边界和低摩擦墙体已升级；保留原有图鉴、倍速、暂停、排行榜、清场与继承。已有素材的来源与权属说明仍然适用。

审查、规则、卡墙证据与测试范围详见 UPGRADE.md。

### 本地与手机测试

1. 在本目录运行 `npm start`，打开 http://127.0.0.1:4173 。不要双击 HTML。
2. `npm run build` 检查静态资源；`npm run lint` 检查脚本语法；`npm test` 运行纯逻辑和浏览器回归。
3. 开发调试使用 `?debugPhysics=1`，完成后去掉参数。`?test=1` 使用隔离的测试纪录。
4. 真机可先打开私有在线试玩地址测试 Safari。若要通过局域网访问电脑，运行 `node server.mjs --host 0.0.0.0`，手机与电脑接同一 Wi-Fi，再访问 `http://电脑局域网IP:4173`。按需允许 Windows 防火墙的专用网络访问。

### GitHub Pages

本项目为纯静态网站，所有资源路径均为相对路径，支持仓库子路径。

- 将本目录作为 GitHub 仓库根目录（包含 dist、scripts 和 .github/workflows/pages.yml），推送到 main。
- 仓库 Settings → Pages → Build and deployment → Source 选择 GitHub Actions。
- 推送 main 或手动运行 “Deploy game to GitHub Pages”，工作流验证素材后仅上传 dist 并部署；网址以成功工作流输出为准。
- 工作流无需提交 node_modules、.openai 配置或本地测试截图，也不会修改当前 Sites 私有地址。
- 未实际创建/发布 GitHub 仓库。

配置依据：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

### 宠物陪玩 v2.1.0

图鉴中点开已解锁角色即可“设为宠物”，选择会保存在当前浏览器。宠物在游戏框外陪玩，支持点击、连续点击与按住头部左右摸头。详细架构、存档迁移、状态和验收记录见 [PET-SYSTEM.md](PET-SYSTEM.md)。
