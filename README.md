# 🧰 Work DevTools

> 面向开发与测试场景的浏览器工具集

当前版本：`1.0.1` · [查看 v1.0.1 版本说明](docs/releases/1.0.1.md)

Work DevTools 是一个 Chrome 扩展（Manifest V3），用于集中承载常用开发辅助工具。当前内置 **Cookie Injector** 和 **常用开发地址**：前者管理 Cookie 与 Bridge 注入，后者按「项目 → 环境 / 页面」维护可复用的开发地址。全部工具数据均可通过 JSON 或 NAS WebDAV 备份同步。

## ✨ Cookie Injector 功能

- **三级维度管理**：人员 → 平台 → Cookie，结构清晰，支持多人多平台快速切换
- **固定平台选择**：平台统一从微信、同程App、同程T站、艺龙T站中选择，不支持手动填写
- **一键注入**：点击平台即可把其下所有 Cookie 注入到当前标签页域名
- **设备预设注入**：平台可绑定微信、同程App等 UA 预设，注入 Cookie 时同步覆盖当前标签页的 User-Agent
- **UA 注入总开关**：统一控制 UA 的绑定和注入；关闭时使用浏览器默认 UA，设备预设页仍可正常查看和维护
- **导入 / 导出**：支持 JSON 格式全量导入导出，方便团队共享与备份
- **跨设备同步**：使用 NAS WebDAV 手动推送/拉取，结合时间戳与 ETag 检测覆盖冲突
- **暗色模式**：支持浅色 / 深色主题切换
- **图标自生成**：内置 SVG 源文件 + sharp 脚本，一键生成 16/48/128 三种尺寸 PNG

## 🔗 常用开发地址功能

- **项目化管理**：为每个项目维护名称、备注、可选 Wiki 地址和多个运行环境
- **环境地址复用**：每个环境保存独立 HTTP/HTTPS 地址，可包含端口、基础 path、查询参数或锚点，并记录跨设备同步的默认环境
- **页面 path 复用**：新建项目默认包含“健康检查 /health”，页面地址可按当前环境复制或在新标签页跳转
- **拖拽排序**：拖动项目或页面图标即可调整展示顺序，结果会自动保存并参与备份同步
- **Wiki 快捷操作**：支持复制 Wiki 地址或直接在新标签页打开
- **右键直达工具**：右键扩展图标可直接进入 Cookie Injector 或常用开发地址设置页

## 📦 项目结构

```
work-devtools/
├── public/                     # WXT 原样复制的扩展图标
├── scripts/
│   ├── icon.svg                # 图标 SVG 源文件（曲奇饼干主题）
│   └── generate-icons.mjs      # 图标生成脚本（SVG → PNG）
├── src/
│   ├── assets/
│   │   └── main.css
│   ├── background/
│   │   └── index.ts            # 后台业务：Cookie、Bridge 与设备配置注入
│   ├── entrypoints/             # WXT 扩展入口
│   │   ├── background.ts        # Service Worker 入口
│   │   ├── popup/               # 工具栏弹窗入口
│   │   └── manager/             # 管理页入口
│   ├── popup/
│   │   ├── App.vue
│   │   ├── main.ts
│   │   ├── components/         # UI 组件
│   │   ├── composables/        # 逻辑组合式函数
│   │   ├── types/              # TypeScript 类型定义
│   │   └── utils/
├── .output/                    # WXT 构建与 zip 产物（gitignore）
├── wxt.config.ts               # WXT 与 Manifest 配置
└── package.json
```

## 🚀 快速开始

### 环境要求

- Node.js ≥ 22.13.0
- Yarn 或 npm

### 安装依赖

```bash
nvm use
yarn
```

### 开发调试

```bash
yarn dev
```

WXT 会构建开发版本并自动启动 Chrome，源码变化后会热更新扩展。

如需手动加载开发产物：

1. 打开 `chrome://extensions`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择项目根目录下的 `.output/chrome-mv3/` 文件夹
4. 工具栏出现 🍪 图标即安装成功

### 生成图标

修改 `scripts/icon.svg` 后，重新生成 PNG：

```bash
yarn icons
```

### 生产构建

```bash
yarn build
```

构建结果位于 `.output/chrome-mv3/`。

### 构建并打包 zip

```bash
yarn zip
```

WXT 会在 `.output/` 目录下生成 Chrome 扩展 zip，可直接发给别人或上传 Chrome 商店。

### GitHub Release 自动发布

仓库通过 GitHub Actions 在推送 `v*` 标签时自动执行测试、打包 Chrome 扩展并创建 GitHub Release。标签版本必须与 `package.json` 中的版本一致，并且必须提前创建 `docs/releases/<version>.md`，工作流会将该文件作为 Release Notes。

```bash
# 示例：package.json 版本已经更新为 1.0.1
git tag v1.0.1
git push origin v1.0.1
```

发布产物名称为 `work-devtools-<version>-chrome.zip`。同一标签重新运行工作流时，会覆盖 Release 中已有的同名 ZIP。

### 版本检查与手动更新

打开管理页或 Popup 时，扩展会读取 GitHub 最新正式 Release；每台设备最多每 24 小时自动请求一次。当前版本入口始终可打开 Releases 列表，发现新版本时可直接查看对应 Release 并手动下载 ZIP 安装；扩展不会自动下载或安装更新。

版本检查缓存保存在独立的 `chrome.storage.local` 键中，不会进入 Work DevTools 业务数据、JSON 导出或 WebDAV 同步。

- [版本发布规范](docs/releases/README.md)
- [v1.0.1 版本说明](docs/releases/1.0.1.md)
- [v1.0.0 版本说明](docs/releases/1.0.0.md)

## 🧩 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Vue 3 + TypeScript |
| 构建 | WXT + Vite |
| 样式 | Tailwind CSS 3 |
| 图标 | lucide-vue-next |
| 存储 | chrome.storage.local（本地） + NAS WebDAV（远端同步） |
| 工具 | sharp（图标生成）、nanoid（ID 生成） |

## 📖 使用说明

### 注入 Cookie

1. 在浏览器打开目标网站
2. 点击工具栏 🍪 图标打开弹窗
3. 选择「人员 → 平台」，点击对应平台
4. 该平台下所有 Cookie 会自动注入到当前标签页域名

### 设备预设

1. 在管理页打开「设备预设」，维护 User-Agent
2. 开启 UA 注入总开关；关闭时不能绑定或注入预设，但设备预设页仍会展示完整 UA 并允许维护
3. 新增或编辑平台时选择对应设备预设，也可以保留浏览器默认 UA
4. Popup 注入平台 Cookie 时会在当前标签页覆盖预设 UA 后刷新页面

UA 覆盖需要 Chrome 的调试权限，只会作用于当前标签页，关闭标签页后自动结束；不会修改视口尺寸、DPR 或触控能力。

### 常用开发地址

1. 右键扩展图标并选择「常用开发地址」，或从管理页左侧进入该工具
2. 添加项目，填写至少一个环境名称和完整 HTTP/HTTPS 域名
3. 新建项目会包含“健康检查 /health”，也可继续添加其他常用页面
4. 拖动项目或页面左侧图标，可调整对应列表的展示顺序
5. 点击「复制完整地址」获得组合地址，或点击「跳转」在新标签页打开
6. 项目设置了 Wiki 时，可选择复制地址或在新标签页打开

### 导入 / 导出

- **导出**：点击右上角 ⬆ 图标，下载全量 JSON 备份
- **导入**：点击右上角 ⬇ 图标，选择 JSON 文件导入（会预览数量并合并）

本机持久化、JSON 备份和 WebDAV 使用同一份工作台根结构。`version` 与 `updatedAt` 只属于 Work DevTools 根节点，各工具仅在 `tools` 下保存自己的业务数据：

```json
{
  "version": 2,
  "updatedAt": 0,
  "tools": {
    "cookieInjector": {
      "persons": [],
      "uaInjectionEnabled": false,
      "deviceProfiles": [],
      "bridgeProviders": [],
      "bridgeMethods": [],
      "cookiePresetGroups": [],
      "cookiePresets": []
    },
    "devAddresses": {
      "projects": []
    }
  }
}
```

旧版扁平 Cookie Injector 本机数据和 JSON 备份会在读取时自动包裹到 `tools.cookieInjector`；1.0.0 工作台数据缺少 `tools.devAddresses` 时会自动补为空工具数据。

### NAS 同步（WebDAV）

通过 WebDAV 专用目录实现跨设备同步。首次配置展示的是示例目录，请替换为自己的 WebDAV 地址：

```text
https://webdav.example.com/webdav/work-devtools-sync/
```

同步文件固定为 `work-devtools-sync.json`。

#### 同步机制

- **手动推送**：将当前本地数据写入 WebDAV JSON 文件
- **手动拉取**：使用 WebDAV 数据覆盖本地数据
- **远端刷新**：只查询同步文件状态和更新时间，不拉取、不覆盖本地数据
- **冲突检测**：操作前比较本地与远端 `updatedAt`，写入时再使用 ETag 条件请求防止并发覆盖
- **无自动同步**：打开管理页、修改 Cookie 或启动浏览器时都不会自动推送或拉取

#### 首次配置

1. 在绿联 NAS 的 `/webdav` 共享文件夹中创建 `work-devtools-sync` 子目录
2. 确认 WebDAV 专用用户对该目录具有读写权限
3. 打开管理页的「同步设置」，填写目录地址、用户名和密码
4. 点击「测试连接」，成功后点击「保存连接」
5. 根据需要手动点击「推送本地配置」或「拉取 NAS 配置」

> 💡 **多台电脑配置**：每台电脑填写相同的 WebDAV 目录和专用账号。断开连接只清除当前电脑保存的凭据，不会删除 NAS 上的同步文件。

绿联 WebDAV、Cloudflare Tunnel 和目录权限需按实际 NAS 环境完成配置。

#### 日常使用流程

```
改完数据 → 点「推送」 → 换电脑 → 点「拉取」
```

#### 数据存储位置

| 数据 | 存储位置 | 说明 |
|------|---------|------|
| Work DevTools 工具数据 | `chrome.storage.local` | 使用统一根键持久化；首次升级自动迁移旧版 Cookie Injector 数据 |
| 同步配置（地址、用户名、密码） | `chrome.storage.local` | 每台设备独立配置，不参与同步 |
| Release 检查缓存 | `chrome.storage.local` | 每台设备独立保存，24 小时内复用；不参与导出或 WebDAV 同步 |
| 远端同步副本 | NAS WebDAV | `/webdav/work-devtools-sync/work-devtools-sync.json` |

#### 安全说明

- 使用只允许访问同步目录的 WebDAV 专用普通用户，不使用 NAS 管理员账号
- 密码只存在本机 `chrome.storage.local`，不会写入同步 JSON、导出文件或代码
- 同步 JSON 包含 Cookie 明文，请限制共享目录权限，不要公开文件内容或截图
- **切勿把 WebDAV 密码贴到聊天、代码、截图或 Git 中**，泄露后立即修改
- 建议只同步测试环境 Cookie，不同步生产环境登录态

## 🔒 权限说明

| 权限 | 用途 |
|------|------|
| `cookies` | 写入 Cookie 到目标域名 |
| `activeTab` | 获取当前标签页 URL 作为注入目标 |
| `storage` | 使用 chrome.storage.local 持久化全部工具数据和同步配置 |
| `contextMenus` | 在扩展图标右键菜单中提供工具设置页入口 |
| `<all_urls>` | 支持向任意域名注入 Cookie，以及访问用户配置的 WebDAV 地址 |

## 📝 License

私有项目，仅供内部使用。
