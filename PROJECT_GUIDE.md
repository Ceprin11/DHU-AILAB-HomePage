# DHU AILAB 网站项目说明

## 技术栈

- 前端：React 18、Vite 6、React Router、Tailwind CSS、Radix UI
- 后端：Node.js 18+、Express 5
- 数据：本地 JSON 文件
- 图片上传：Multer，本地文件存储

项目不依赖 Base44，前端、接口、数据和上传文件均可部署在实验室服务器上。

## 项目架构

```text
website/
├─ src/
│  ├─ pages/              页面与管理后台
│  ├─ components/         公共组件和后台编辑组件
│  ├─ api/client.js       前端 API 客户端
│  ├─ lib/                登录状态和工具函数
│  └─ App.jsx             前端路由入口
├─ server/
│  ├─ index.js            API、管理员登录、上传和静态文件服务
│  └─ store.js            JSON 数据读写与校验
├─ public/                Logo、默认图片等静态资源
├─ data/                  运行数据和上传文件，不提交 Git
├─ .env.example           环境变量示例
└─ package.json           依赖与运行命令
```

数据流：

```text
浏览器 → /api → Express → data/site-data.json
管理后台 → /api/upload → data/uploads/
```

管理员入口为 `/admin-login`。账号、密码和会话密钥由服务器环境变量设置，登录状态保存在 HttpOnly Cookie 中。

## 部署教程

环境要求：Node.js 18+，服务器需要允许应用写入 `data/` 目录。

```bash
git clone https://github.com/Ceprin11/DHU-AILAB-HomePage.git
cd DHU-AILAB-HomePage
npm install
cp .env.example .env
npm run build
npm start
```

修改 `.env` 中的生产配置：

```env
PORT=3000
ADMIN_ACCOUNT=AILAB
ADMIN_PASSWORD=请设置强密码
SESSION_SECRET=请设置一段足够长的随机字符串
DATA_DIR=data
COOKIE_SECURE=true
```

启动后访问 `http://服务器地址:3000`。正式上线建议使用 Nginx 反向代理到 `127.0.0.1:3000` 并配置 HTTPS；同时持久化并定期备份 `data/` 目录。
