# dsh-settings-search-plugin

[English](README.md) | 中文

一个纯浏览器端插件，为 DSH Web 的设置面板添加搜索框。输入时在内容列上方显示独立的候选列表；点击候选跳转到所属设置分区，对于条目级候选还会聚焦并高亮对应设置项。注册是可选的——设置分区从 slot 账本（ledger）及其渲染后的 DOM 自动建索引，因此第三方设置页无需任何改动即可被搜索。

## 索引如何构建

可搜索条目来自三个数据源，按优先级排列：

1. **Slot 账本（声明式，始终完整）** —— 每一个 `settings.section` 注册都是分区级候选，无论其插件是否注册搜索元数据、无论用户是否访问过该分区。账本通过注入的 `slots` 服务读取，因此任何贡献设置页的插件都会立即出现在搜索中。
2. **注册面（可选增强）** —— 设置插件可以调用 `window.__DSH_SETTINGS_SEARCH__.register(sectionId, spec)` 注册条目级行、丰富关键词和 `data-settings-item` 锚点，以获得精确的跳转与聚焦。注册是自愿的；未注册的分区仍可从账本获得分区级搜索。
3. **渲染 DOM 扫描（已访问的分区）** —— 分区观察器扫描当前分区的 DOM（`label > strong + small`、`[class*="title"]/[class*="heading"]` 分组、标题，以及短文本叶子节点），按分区缓存条目级候选。这覆盖了未注册插件——用户打开其页面后即可搜索；在此之前只能搜到分区名。

候选行渲染为按钮，携带设置项名称、可选描述，以及所属分区的标签徽章。点击条目会跳转到其分区、将设置项滚动到视野内，并闪烁高亮边框；锚定（已注册）的行按 `data-settings-item` 解析，扫描得到的行则回退为按标题文本匹配。

## 读写行为

插件读取 `slots` 服务获取账本，并观察设置对话框的 DOM。它不写入任何网络数据：搜索状态、注册面与候选浮层都是页面本地状态。注册面是 `globalThis` 上的普通对象（`__DSH_SETTINGS_SEARCH__`），因此设置插件可以在本插件 bundle 挂载之前注册；谁先加载谁创建持有者，`register` 总是写入共享 Map。

对话框与分区容器按结构定位（`nav`、`nav` 的下一个兄弟、其最后一个子元素），而不是按类名——DSH 客户端使用 CSS Modules 的哈希类名，类选择器不可靠。nav 标签取按钮中最长的 span 文本，以排除 SVG 路径数据。

## 注册参考

```ts
// 在设置插件的客户端 apply() 中：
window.__DSH_SETTINGS_SEARCH__?.register('local-shell-tools', {
  label: 'Shell',
  keywords: 'shell 终端 命令 cmd bash powershell pwsh 语言环境',
  items: [
    { id: 'bashLang', label: '语言环境', desc: '写入 LANG 与 LC_ALL', keywords: '语言 locale lang 环境' },
  ],
})
```

注册表持有者由任一方惰性创建，因此即使本插件缺失或更晚加载，可选链也是安全的。`items[].id` 应与渲染设置项容器上的 `data-settings-item` 属性一致，以获得锚定聚焦。

## Model Experience

None, as a presentation-only plugin：搜索候选与导航是浏览器 UI，绝不进入模型请求。本插件不贡献任何系统提示词与工具 schema。

#### KV Cache 效应

无失效。插件完全运行在浏览器中，不改变任何模型请求形态，因此不会影响已建立的 prefix。

## 已知限制与待办

- **从未访问且未注册的分区的条目级搜索** —— 账本为每个分区提供分区级行，但条目级候选来自注册面或渲染 DOM。用户从未打开过、且其插件从未注册的分区只暴露分区名；此类分区的完整条目覆盖需要读取各插件的 locale 字典，或在 `slots.register` 中提供 `searchItems` 通道，两者均待办。
- **候选文本做归一化而非词干化** —— 匹配是大小写与空白归一化后的子串包含；未实现拼音与模糊召回。
- **浮层是页面本地的绝对定位层** —— 安装时跟踪设置面板的头部与 nav 宽度；主题在对话框挂载后改变这些尺寸时，需要重新打开面板重新测量。

## 安装

复制下面的指令块给你的 DSH agent，它会自动完成安装：

```text
请安装 settings-search 插件（@doiiarx/dsh-settings-search-plugin）：

1. 克隆仓库：
   git clone https://github.com/DoiiarX/dsh-settings-search-plugin
   cd dsh-settings-search-plugin
2. 安装依赖：pnpm install
   （构建产物 lib/ 已提交；peer 依赖 @deepseek-ai/cordis 与
   @deepseek-ai/dsh-client-ui-slots 由 harness 运行时提供。）
3. 挂进 web profile：编辑 $HOME/.dsh/profiles/web/package.json，
   在 dependencies 加 "@doiiarx/dsh-settings-search-plugin": "link:<本插件目录绝对路径>"，
   在 dsh.profile.bundles 加 "@doiiarx/dsh-settings-search-plugin"。
4. 在 profile 目录执行 pnpm install。
5. 重启 web 进程，验证设置面板出现搜索框。
```

本插件纯浏览器端（无 settings 命名空间、无模型工具），不需要改
WEB_SETTINGS_NAMESPACES 白名单，也不需要重 build host。
