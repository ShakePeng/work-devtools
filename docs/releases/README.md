# Work DevTools 版本发布规范

本目录用于保存每个正式版本的发布说明。升级版本和创建 GitHub Release 时必须遵循以下约定。

## 必须遵守

1. 每次修改 `package.json` 的 `version` 时，必须同时创建对应版本的发布说明。
2. 文件路径固定为 `docs/releases/<version>.md`，文件名不带 `v` 前缀。
3. 发布说明必须和版本修改放在同一次代码变更中，并在创建 `v<version>` 标签前完成。
4. 内容只能记录当前版本实际完成的功能、调整和验证结果。
5. “升级注意事项”和“验证结果”必须保留；未执行的验证不得标记为通过。“验证结果”仅供仓库追溯，GitHub Release 描述会自动过滤该小节。
6. GitHub Actions 会校验版本、标签和发布说明文件，任意一项不一致都会停止发布。

## 发布流程

1. 更新 `package.json` 中的版本号。
2. 创建 `docs/releases/<version>.md` 并填写实际变更。
3. 执行测试和打包验证。
4. 提交版本变更并合并到 `main`。
5. 创建并推送 `v<version>` 标签。
6. GitHub Actions 自动测试、打包，过滤“验证结果”小节后创建 GitHub Release。

## 发布说明模板

```markdown
# Work DevTools v<version>

发布日期：YYYY-MM-DD

用一段话概括本版本的目标和用户价值。

## 新增功能

- 新增内容。

## 调整内容

- 调整内容。

## 问题修复

- 修复内容。

## 升级注意事项

- 无。


## 安装方法

1. 从 GitHub Releases 下载 `work-devtools-<version>-chrome.zip`。
2. 解压 ZIP 文件。
3. 打开 Chrome 扩展管理页并开启开发者模式。
4. 点击“加载已解压的扩展程序”，选择解压后的目录。
```

没有内容的可选章节可以删除，但不能省略升级注意事项、验证结果和安装方法。
