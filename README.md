# 📋 实时共享待办清单 (Shared Todo)

一个基于 React + Vite + Socket.io + SQLite 的实时共享待办清单应用。创建清单后生成分享链接，任何人打开链接都可以添加、勾选、编辑、删除任务，所有在线用户的页面都会实时同步更新。

## ✨ 功能特性

- 🚀 **创建清单** — 输入标题即可创建，自动生成唯一分享链接
- 🔗 **一键分享** — 复制链接发送给朋友，无需注册登录
- ⚡ **实时同步** — 基于 WebSocket (Socket.io)，任何人的操作都会即时广播给所有在线用户
- ✅ **任务管理** — 添加、勾选完成、编辑文本、删除任务
- 👥 **在线人数** — 实时显示当前查看同一清单的人数
- 📱 **响应式设计** — 适配桌面端和移动端

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + React Router 6 + Vite 5 |
| 实时通信 | Socket.io (客户端 + 服务端) |
| 后端 | Node.js + Express |
| 数据库 | SQLite (better-sqlite3) |
| 样式 | 原生 CSS（无框架依赖） |

## 📁 项目结构

```
shared-todo/
├── server/                     # 后端
│   ├── package.json
│   └── src/
│       ├── index.js            # Express + Socket.io 入口
│       ├── db.js               # SQLite 数据库与表结构
│       ├── routes/
│       │   ├── lists.js        # 清单 REST API
│       │   └── items.js        # 任务 REST API
│       └── socket/
│           └── index.js        # Socket.io 房间与广播
├── client/                     # 前端
│   ├── package.json
│   ├── vite.config.js          # API / WebSocket 代理
│   └── src/
│       ├── App.jsx             # 路由定义
│       ├── api.js              # REST 封装
│       ├── socket.js           # Socket.io 客户端
│       ├── pages/
│       │   ├── HomePage.jsx    # 创建清单页
│       │   └── ListPage.jsx    # 清单协作页
│       └── components/
│           ├── TodoItem.jsx    # 任务项组件
│           ├── ShareLink.jsx   # 分享链接组件
│           └── Header.jsx      # 顶部导航
└── README.md
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装

```bash
# 克隆项目
git clone https://github.com/oawdji/share-todo.git
cd share-todo

# 安装后端依赖
cd server
npm install

# 安装前端依赖
cd ../client
npm install
```

### 运行

**启动后端**（端口 3001）：

```bash
cd server
npm start
```

**启动前端**（端口 5173）：

```bash
cd client
npm run dev
```

打开浏览器访问 `http://localhost:5173`

### 使用方式

1. 在首页输入清单标题，点击「创建清单」
2. 复制页面上方的分享链接，发送给朋友
3. 所有人可以在同一清单中添加、勾选、编辑、删除任务
4. 所有操作实时同步，无需刷新页面

## 📡 API 文档

### REST API

| 方法 | 路径 | 说明 | 请求体 |
|------|------|------|--------|
| POST | `/api/lists` | 创建清单 | `{ "title": "清单标题" }` |
| GET | `/api/lists/:shareId` | 获取清单及任务 | — |
| POST | `/api/lists/:shareId/items` | 添加任务 | `{ "text": "任务内容" }` |
| PATCH | `/api/lists/:shareId/items/:itemId` | 更新任务 | `{ "text"?: "...", "completed"?: true/false }` |
| DELETE | `/api/lists/:shareId/items/:itemId` | 删除任务 | — |

### Socket.io 事件

| 事件 | 方向 | 说明 |
|------|------|------|
| `join-list` | 客户端 → 服务端 | 加入清单房间 |
| `leave-list` | 客户端 → 服务端 | 离开清单房间 |
| `item-added` | 服务端 → 客户端 | 有新任务添加 |
| `item-updated` | 服务端 → 客户端 | 有任务被更新 |
| `item-deleted` | 服务端 → 客户端 | 有任务被删除 |
| `user-joined` | 服务端 → 客户端 | 有新用户加入 |
| `user-left` | 服务端 → 客户端 | 有用户离开 |

## 🗄 数据库设计

### lists 表

| 列 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | 内部 UUID |
| title | TEXT | 清单标题 |
| share_id | TEXT UNIQUE | 分享链接标识 |
| created_at | TEXT | 创建时间 |
| updated_at | TEXT | 更新时间 |

### items 表

| 列 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | UUID |
| list_id | TEXT FK | 所属清单 |
| text | TEXT | 任务内容 |
| completed | INTEGER | 0=未完成, 1=完成 |
| position | INTEGER | 排序 |
| created_at | TEXT | 创建时间 |

## 📄 License

MIT
