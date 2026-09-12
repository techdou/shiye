# 拾页 · ShiYe

> 把散落的网页与讲义，拾进一本随身的册子。

拾页是一个轻量的「网页资料库」：导入 HTML / Markdown / 图片并完整渲染，用文件夹分类整理，收藏常用网址随点随看。所有数据保存在本机，离线可用。

- **Web（PWA）**：<https://techdou.github.io/shiye/> —— 手机浏览器打开后「添加到主屏幕」，即获得独立 app 体验（Android / iOS 通用）
- **Android APK**：Capacitor 打包，资源全部内置，完全离线（构建方式见下文）

## 功能

| 功能 | 说明 |
| --- | --- |
| HTML 渲染 | 内置浏览器完整渲染，样式 / 脚本 / 外部资源照常工作 |
| Markdown 渲染 | 内核移植自 [冷铱 Markdown 编辑器](https://github.com/woyin2024/lengyi-markdown-editor)：marked + KaTeX（`$` / `$$` 公式）+ Mermaid 10 + protectMath 管线，另补 highlight.js 代码高亮 |
| MD 编辑 | 一键进入编辑，常用块快捷工具条，保存即重渲染 |
| 图片查看 | png / jpg / gif / webp / svg / bmp，居中适配 |
| 文件夹管理 | 新建 / 重命名 / 移动 / 删除（级联）；同文件夹图片可被 MD 相对路径引用 |
| 网页收藏 | 保存已上线的讲义地址随点随看；Android 安装后支持系统「分享 → 拾页」直接收藏 |
| 整理能力 | 全局搜索、最近打开、面包屑导航、右缘渐隐轮播 |
| 主题 | 深浅色跟随系统，可手动覆盖 |
| 数据安全 | 设置内可导出 / 恢复 JSON 备份 |

## 架构：一套代码，两个端

```
docs/            纯前端 PWA（站点根）──────────► GitHub Pages
android/         Capacitor 原生壳工程 ────────► Android APK
```

- **Web**：`docs/` 即站点根，纯静态零构建，任何静态托管可跑
- **App**：Capacitor 把 `docs/` 整体装入 Android WebView，资源内置、真离线

## 本地开发

```bash
# 站点根就是 docs/，任何静态服务器可跑（必须 http，file:// 下 Service Worker 不可用）
python -m http.server 8765 --directory docs
# 打开 http://127.0.0.1:8765/
```

## 发布（GitHub Pages）

仓库 Pages 源固定为 `main` 分支 `/docs` 目录，push 即部署。改代码后记得递增 `docs/sw.js` 里的 `CACHE_VERSION`，客户端刷新才会拿到新版本。

## Android 构建

前置：JDK 21（Capacitor 8 要求）、Android SDK（cmdline-tools + platform 35 + build-tools 35）、Node 18+

```bash
npm install
npx cap sync android
cd android && ./gradlew assembleDebug
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
```

应用内返回键已映射：阅读器打开时返回 = 关闭阅读器，否则按系统默认。

## 目录结构

```
├── docs/                  # 站点根（GitHub Pages 源）
│   ├── index.html         # 应用外壳
│   ├── manifest.webmanifest
│   ├── sw.js              # Service Worker：shell 预缓存 + 大件运行时缓存
│   ├── css/app.css        # 设计系统（纸感令牌 / 组件 / 明暗主题）
│   ├── js/
│   │   ├── main.js        # 入口：装配 + 分享接收 + SW 注册
│   │   ├── db.js          # IndexedDB 封装
│   │   ├── store.js       # 状态与业务（条目树 CRUD / 导入 / 搜索 / 播种）
│   │   ├── render/md-view.js  # MD 渲染内核（iframe 内运行，移植冷铱管线）
│   │   └── ui/            # library / reader / sheets / settings
│   ├── vendor/            # marked / KaTeX(含字体) / Mermaid 10 / highlight.js
│   └── icons/             # SVG 源 + GDI+ 生成脚本 + PNG
├── android/               # Capacitor 原生工程（gitignore 掉构建产物）
├── capacitor.config.ts
├── package.json
└── .gitignore
```

## 数据与隐私

所有内容（文件、文件夹、收藏）仅存于设备本地（IndexedDB）。无服务器、无账号、无统计、无任何密钥或遥测。

## 许可

MIT © [techdou](https://github.com/techdou)。vendor 组件版权归各自作者：marked (MIT) · KaTeX (MIT) · Mermaid (MIT) · highlight.js (BSD-3)。
