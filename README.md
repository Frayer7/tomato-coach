# 🍅 番茄教练 (Tomato Coach)

一个移动优先的番茄钟 PWA，通过 **LLM 教练** 分析专注数据，追踪改进建议，帮助你提升工作效率。

## 核心功能

- **目标引导的番茄钟**：开始前设定目标，结束后评价质量与总结
- **LLM 教练洞察**：生成日报/周报，发现效率规律，给出行动建议
- **待改进提醒池**：自动追踪顽固问题，逐日升级提醒，直到你解决它
- **数据便携**：一键复制记录到 Excel，支持本地导出 / 导入 JSON
- **跨设备云同步（可选）**：通过 GitHub Gist + 端到端加密实现多端同步
- **PWA 支持**：可添加到手机桌面，离线使用

## 技术栈

纯静态前端，无需构建步骤，直接部署到 GitHub Pages。

- HTML / CSS / JavaScript（零依赖）
- LLM API（兼容 OpenAI / DeepSeek 等）
- Service Worker 离线缓存
- localStorage 本地存储

## 快速开始

1. Fork 本仓库，或下载代码
2. 部署到 **GitHub Pages**（Settings → Pages → 选择分支根目录）
3. 打开网址，进入「⚙️ 设置」配置你的 LLM API Key
4. 开始第一个番茄 🍅

## 项目结构
- index.html # 页面骨架
- style.css # 全部样式
- app.js # 全部业务逻辑
- manifest.json # PWA 配置
- sw.js # 离线缓存

## 使用说明

- **手机**推荐添加到主屏幕，体验接近原生 App
- 电脑端适合做周报分析和数据管理
- 每日结束可复制记录文本，粘贴到 Excel / WPS 归档
- 多设备同步需在设置页配置 GitHub Token，数据端到端加密存储于私有 Gist

## 许可证

MIT
