# SQL Copilot 浏览器插件

一个 AI 驱动的 SQL 助手浏览器插件，帮助用户快速生成和执行 SQL 查询。

## 功能特性

- 🤖 AI 驱动的 SQL 生成
- 🎯 智能识别页面中的 SQL 输入框
- 📋 一键复制生成的 SQL
- 🚀 自动插入 SQL 到页面并执行
- 🎨 可拖拽的浮动面板
- ⌨️ 键盘快捷键支持
- 🔧 可配置的 API 设置

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **样式**: Tailwind CSS
- **浏览器 API**: Chrome Extension Manifest V3
- **状态管理**: React Hooks

## 安装和开发

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式

```bash
npm run dev
```

### 3. 构建生产版本

```bash
npm run build
```

### 4. 监听文件变化

```bash
npm run watch
```

## 在 Chrome 中安装插件

1. 运行 `npm run build` 构建项目
2. 打开 Chrome 浏览器，进入 `chrome://extensions/`
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择项目的 `dist` 文件夹

## 使用方法

### 基本使用

1. 在任意网页上点击插件图标
2. 在弹出窗口中描述你需要的 SQL 查询
3. 点击"生成 SQL"按钮
4. 生成的 SQL 会自动插入到页面中的 SQL 输入框
5. 可选择自动执行查询

### 快捷键

- `Ctrl + Shift + S`: 显示/隐藏浮动面板

### 浮动面板

- 在任意网页上按快捷键或通过插件触发
- 面板可以拖拽到任意位置
- 支持直接在面板中生成 SQL

## 配置

### AI API 设置

在插件的设置面板中配置：

- **API 端点**: 你的 AI 服务 API 地址
- **API 密钥**: 访问 AI 服务的认证密钥

### 支持的 AI 服务

- OpenAI GPT
- Claude
- 其他兼容 OpenAI API 格式的服务

## 项目结构

```
src/
├── components/          # React组件
│   └── Popup.tsx      # 主弹出窗口组件
├── popup.html          # 弹出窗口HTML
├── popup.tsx           # 弹出窗口入口
├── content.ts          # 内容脚本
├── content.css         # 内容脚本样式
├── background.ts       # 后台脚本
├── index.css           # 全局样式
└── types/              # TypeScript类型定义

dist/                   # 构建输出目录
manifest.json           # 插件配置文件
```

## 开发说明

### Content Script

`content.ts` 负责：

- 创建可拖拽的浮动面板
- 识别页面中的 SQL 输入框
- 自动插入 SQL 并执行
- 与 popup 通信

### Background Script

`background.ts` 负责：

- 插件生命周期管理
- 快捷键处理
- 标签页间通信

### Popup

弹出窗口提供：

- 聊天界面
- API 设置
- 消息历史

## 自定义和扩展

### 添加新的 AI 服务

在 `callAIAPI` 函数中添加新的 API 调用逻辑：

```typescript
private async callAIAPI(prompt: string): Promise<string> {
  // 根据配置选择不同的AI服务
  const config = await this.getConfig()

  if (config.provider === 'openai') {
    return this.callOpenAI(prompt, config)
  } else if (config.provider === 'claude') {
    return this.callClaude(prompt, config)
  }
}
```

### 自定义 SQL 识别规则

在 `findSQLInputs` 方法中添加新的选择器：

```typescript
private findSQLInputs(): HTMLElement[] {
  const selectors = [
    // 现有选择器...
    'textarea[data-role="sql-editor"]',
    '.custom-sql-input'
  ]
  // ...
}
```

## 故障排除

### 常见问题

1. **插件不工作**

   - 检查浏览器控制台是否有错误
   - 确认 manifest.json 配置正确
   - 重新加载插件

2. **无法识别 SQL 输入框**

   - 检查页面元素的选择器
   - 添加自定义选择器规则

3. **API 调用失败**
   - 检查 API 配置是否正确
   - 确认网络连接正常
   - 查看 API 服务状态

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License
