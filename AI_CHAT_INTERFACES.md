# VS Code AI Chat & GitHub Copilot 接口梳理文档

## 📋 概述

本文档详细梳理了VS Code AI Chat和GitHub Copilot功能的核心接口、数据结构和调用流程，帮助开发者理解如何替换成自己的AI服务。

## 🏗️ 核心架构组件

### 1. AI Chat 核心服务层
- **`ChatService`** (`src/vs/workbench/contrib/chat/common/chatServiceImpl.ts`)
  - 主要的聊天服务实现，管理聊天会话、请求和响应
  - 处理聊天请求的发送、接收和状态管理
  - 支持多种聊天模式：`ChatModeKind.Ask`、`ChatModeKind.Edit`、`ChatModeKind.Agent`

### 2. UI 组件层
- **`ChatEditor`** (`src/vs/workbench/contrib/chat/browser/chatEditor.ts`)
  - 聊天编辑器组件，作为独立的编辑器面板
  - 管理聊天会话的显示和交互

- **`ChatViewPane`** (`src/vs/workbench/contrib/chat/browser/chatViewPane.ts`)
  - 聊天视图面板，可以在侧边栏或辅助栏中显示
  - 支持聊天会话的持久化和恢复

- **`ChatWidget`** (`src/vs/workbench/contrib/chat/browser/chatWidget.ts`)
  - 核心聊天小部件，处理用户输入和AI响应显示
  - 支持文件引用、工具调用、动态变量等功能

### 3. 内联聊天 (Inline Chat)
- **`InlineChatController`** (`src/vs/workbench/contrib/inlineChat/browser/inlineChatController.ts`)
  - 管理编辑器中的内联聊天功能
  - 支持代码编辑建议和实时协作

### 4. AI Agent 系统
- **`ChatAgentService`** (`src/vs/workbench/contrib/chat/common/chatAgents.ts`)
  - 管理AI代理的注册、发现和调用
  - 支持多种AI代理：GitHub Copilot、自定义代理等

### 5. 扩展点系统
- **`ExtHostChatAgents2`** (`src/vs/workbench/api/common/extHostChatAgents2.ts`)
  - 扩展主机API，允许扩展注册自定义聊天代理
  - 处理扩展与主进程之间的通信

## 🔧 关键功能特性

### 1. 智能补全系统
- **`chatInputCompletions.ts`** - 提供聊天输入的智能补全
  - 支持斜杠命令补全 (`/command`)
  - 支持AI代理补全 (`@agent`)
  - 支持动态变量补全 (`#variable`)
  - 支持工具调用补全

### 2. 文件引用和上下文
- 支持文件拖拽和引用 (`#file:filename`)
- 支持代码选择引用 (`#selection`)
- 支持符号引用 (`#sym:symbolname`)

### 3. 工具集成
- **`LanguageModelToolsService`** - 管理AI工具调用
- 支持MCP (Model Context Protocol) 服务器
- 支持自定义工具和函数调用

### 4. 多模态支持
- 文本输入和响应
- 图片附件支持
- 语音输入支持（通过语音聊天动作）

## 📋 核心接口定义

### 1. 聊天请求接口 (IChatAgentRequest)

```typescript
interface IChatAgentRequest {
  // 基础信息
  sessionId: string;           // 会话ID
  requestId: string;           // 请求ID
  agentId: string;             // AI代理ID
  command?: string;            // 斜杠命令
  message: string;             // 用户消息内容
  attempt?: number;            // 重试次数

  // 功能控制
  enableCommandDetection?: boolean;    // 是否启用命令检测
  isParticipantDetected?: boolean;     // 是否检测到参与者

  // 上下文数据
  variables: IChatRequestVariableData; // 变量数据
  location: ChatAgentLocation;         // 聊天位置
  locationData?: IChatLocationData;    // 位置相关数据

  // 用户选择
  userSelectedModelId?: string;        // 用户选择的模型ID
  userSelectedTools?: UserSelectedTools; // 用户选择的工具

  // 模式指令
  modeInstructions?: IChatRequestModeInstructions;

  // 文件编辑事件
  editedFileEvents?: IChatAgentEditedFileEvent[];

  // 聊天摘要
  chatSummary?: {
    prompt?: string;
    history?: string;
  };
}
```

### 2. 聊天响应接口 (IChatAgentResult)

```typescript
interface IChatAgentResult {
  // 错误信息
  errorDetails?: IChatResponseErrorDetails;

  // 时间统计
  timings?: IChatAgentResultTimings;

  // 元数据
  metadata?: { readonly [key: string]: any };

  // 详细信息
  details?: string;

  // 后续问题
  nextQuestion?: IChatQuestion;
}

interface IChatResponseErrorDetails {
  message: string;                    // 错误消息
  responseIsIncomplete?: boolean;     // 响应是否不完整
  responseIsFiltered?: boolean;       // 响应是否被过滤
  responseIsRedacted?: boolean;       // 响应是否被编辑
  isQuotaExceeded?: boolean;          // 是否超出配额
  isRateLimited?: boolean;            // 是否被限流
  level?: ChatErrorLevel;             // 错误级别
  confirmationButtons?: IChatResponseErrorDetailsConfirmationButton[];
  code?: string;                      // 错误代码
}
```

### 3. 语言模型消息接口 (IChatMessage)

```typescript
interface IChatMessage {
  name?: string;                      // 消息名称
  role: ChatMessageRole;              // 消息角色 (System/User/Assistant)
  content: IChatMessagePart[];        // 消息内容
}

// 消息部分类型
type IChatMessagePart =
  | IChatMessageTextPart              // 文本部分
  | IChatMessageToolResultPart        // 工具结果部分
  | IChatResponseToolUsePart          // 工具使用部分
  | IChatMessageImagePart             // 图片部分
  | IChatMessageDataPart              // 数据部分
  | IChatMessageThinkingPart;         // 思考部分

interface IChatMessageTextPart {
  type: 'text';
  value: string;
  audience?: LanguageModelPartAudience[];
}

interface IChatMessageImagePart {
  type: 'image_url';
  value: IChatImageURLPart;
}

interface IChatMessageDataPart {
  type: 'data';
  mimeType: string;
  data: VSBuffer;
  audience?: LanguageModelPartAudience[];
}
```

### 4. 语言模型响应接口 (ILanguageModelChatResponse)

```typescript
interface ILanguageModelChatResponse {
  // 响应内容
  content: IChatResponsePart[];

  // 工具调用
  toolCalls?: IChatResponseToolUsePart[];

  // 元数据
  metadata?: { readonly [key: string]: any };
}

// 响应部分类型
type IChatResponsePart =
  | IChatResponseTextPart             // 文本响应
  | IChatResponseToolUsePart          // 工具使用
  | IChatResponseDataPart             // 数据响应
  | IChatResponseThinkingPart;        // 思考响应

interface IChatResponseTextPart {
  type: 'text';
  value: string;
  audience?: LanguageModelPartAudience[];
}

interface IChatResponseToolUsePart {
  type: 'tool_use';
  name: string;                       // 工具名称
  toolCallId: string;                 // 工具调用ID
  parameters: any;                    // 工具参数
}
```

### 5. 工具调用接口 (IToolInvocation)

```typescript
interface IToolInvocation {
  callId: string;                     // 调用ID
  toolId: string;                     // 工具ID
  parameters: Object;                 // 工具参数
  tokenBudget?: number;               // Token预算
  context: IToolInvocationContext;    // 调用上下文
  chatRequestId?: string;             // 聊天请求ID
  chatInteractionId?: string;         // 聊天交互ID
  fromSubAgent?: boolean;             // 是否来自子代理
  toolSpecificData?: any;             // 工具特定数据
  modelId?: string;                   // 模型ID
}

interface IToolInvocationContext {
  sessionId: string;                  // 会话ID
}
```

### 6. 工具结果接口 (IToolResult)

```typescript
interface IToolResult {
  content: (IToolResultPromptTsxPart | IToolResultTextPart | IToolResultDataPart)[];
  toolResultMessage?: string | IMarkdownString;
  toolResultDetails?: Array<URI | Location> | IToolResultInputOutputDetails | IToolResultOutputDetails;
  toolResultError?: string;
  toolMetadata?: unknown;
}

interface IToolResultTextPart {
  kind: 'text';
  value: string;
  audience?: LanguageModelPartAudience[];
}

interface IToolResultDataPart {
  kind: 'data';
  mimeType: string;
  data: VSBuffer;
  audience?: LanguageModelPartAudience[];
}
```

## 🔄 数据流和调用流程

### 1. 聊天请求流程

```
用户输入 → ChatWidget → ChatService → ChatAgentService → 您的AI服务
    ↓
IChatAgentRequest → 您的API → IChatAgentResult
```

### 2. 语言模型调用流程

```
ChatAgent → LanguageModelsService → 您的语言模型服务
    ↓
IChatMessage[] → 您的API → ILanguageModelChatResponse
```

### 3. 工具调用流程

```
AI响应 → ToolUsePart → LanguageModelToolsService → 您的工具服务
    ↓
IToolInvocation → 您的工具API → IToolResult
```

## 🛠️ 替换服务的实现要点

### 1. 实现IChatAgentImplementation接口

```typescript
class YourChatAgent implements IChatAgentImplementation {
  async invoke(
    request: IChatAgentRequest,
    progress: (parts: IChatProgress[]) => void,
    history: IChatAgentHistoryEntry[],
    token: CancellationToken
  ): Promise<IChatAgentResult> {
    // 1. 处理请求
    const messages = this.buildMessages(request, history);

    // 2. 调用您的AI服务
    const response = await this.callYourAIService(messages, token);

    // 3. 处理响应
    return this.processResponse(response);
  }
}
```

### 2. 实现ILanguageModelChat接口

```typescript
class YourLanguageModel implements ILanguageModelChat {
  async sendRequest(
    messages: IChatMessage[],
    options: { [name: string]: any },
    token: CancellationToken
  ): Promise<ILanguageModelChatResponse> {
    // 调用您的语言模型API
    const response = await this.callYourModelAPI(messages, options, token);
    return this.formatResponse(response);
  }
}
```

### 3. 实现工具服务

```typescript
class YourToolService implements IToolImplementation {
  async invoke(
    invocation: IToolInvocation,
    progress: ToolProgress,
    token: CancellationToken
  ): Promise<IToolResult> {
    // 调用您的工具API
    const result = await this.callYourToolAPI(invocation, token);
    return this.formatToolResult(result);
  }
}
```

## 📝 关键配置和注册

### 1. 注册聊天代理

```typescript
// 在扩展的activate函数中
const agentData: IChatAgentData = {
  id: 'your-agent-id',
  name: 'Your Agent',
  description: 'Your custom AI agent',
  extensionId: context.extension.id,
  // ... 其他配置
};

const agentImpl: IChatAgentImplementation = new YourChatAgent();
const agent: IChatAgent = { ...agentData, ...agentImpl };

chatAgentService.registerAgent(agent);
```

### 2. 注册语言模型

```typescript
const modelMetadata: ILanguageModelChatMetadata = {
  extension: context.extension.id,
  name: 'Your Model',
  id: 'your-model-id',
  vendor: 'Your Company',
  version: '1.0.0',
  family: 'your-model-family',
  maxInputTokens: 100000,
  maxOutputTokens: 4000,
  capabilities: {
    vision: true,
    toolCalling: true,
    agentMode: true
  }
};

const modelImpl: ILanguageModelChat = new YourLanguageModel();
languageModelsService.registerLanguageModelChat(modelMetadata, modelImpl);
```

## 🎯 替换建议

1. **保持接口兼容性** - 确保您的服务返回的数据结构符合VS Code的接口定义
2. **处理错误情况** - 实现完整的错误处理和重试机制
3. **支持流式响应** - 通过progress回调实现实时响应更新
4. **工具集成** - 如果需要，实现工具调用功能
5. **认证和授权** - 处理API密钥和用户认证
6. **性能优化** - 实现缓存和批处理机制

## 📁 关键文件结构

```
src/vs/workbench/contrib/chat/
├── browser/                    # UI组件
│   ├── chatEditor.ts          # 聊天编辑器
│   ├── chatViewPane.ts        # 聊天视图面板
│   ├── chatWidget.ts          # 聊天小部件
│   └── actions/               # 聊天动作和命令
├── common/                    # 核心服务
│   ├── chatServiceImpl.ts     # 聊天服务实现
│   ├── chatAgents.ts          # AI代理管理
│   ├── chatModel.ts           # 聊天数据模型
│   ├── languageModels.ts      # 语言模型接口
│   └── languageModelToolsService.ts # 工具服务
└── electron-browser/          # 桌面版特定功能
    └── chat.contribution.ts   # 聊天功能注册

src/vs/workbench/contrib/inlineChat/
├── browser/
│   └── inlineChatController.ts # 内联聊天控制器
└── common/
    └── inlineChat.ts          # 内联聊天定义
```

## 🚀 扩展开发支持

VS Code提供了丰富的扩展点，允许开发者：

1. **注册自定义AI代理** - 通过`chatAgents`扩展点
2. **添加聊天工具** - 通过`languageModelTools`扩展点
3. **自定义聊天会话** - 通过`chatSessions`扩展点
4. **集成外部AI服务** - 通过扩展API

## 📚 相关资源

- [VS Code扩展开发文档](https://code.visualstudio.com/api)
- [VS Code AI Chat扩展点](https://code.visualstudio.com/api/extension-guides/chat)
- [语言模型集成指南](https://code.visualstudio.com/api/extension-guides/language-model)

---

*本文档基于VS Code源码分析生成，涵盖了AI Chat和GitHub Copilot功能的核心接口和实现细节。*
