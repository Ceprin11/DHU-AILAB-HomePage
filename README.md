# DHU AILAB HomePage

东华大学人工智能创新实验室个人网站初版，包含实验室介绍、成员、通知、成果、活动、资料、问答、招新和管理后台。

## 技术栈

- React 18 + Vite
- Tailwind CSS
- Base44 SDK 与数据实体

## 本地运行

```bash
npm install
npm run dev
```

浏览器访问 Vite 输出的地址，通常为 `http://localhost:5173/`。

生产构建：

```bash
npm run build
```

构建产物位于 `dist/`，部署时需要为单页应用配置路由回退到 `index.html`。

## 管理后台

- 登录地址：`/admin-login`
- 账号：`AILAB`
- 密码：`AILAB123`

当前账号密码写在前端，仅适合初版演示。正式部署前应替换为服务器端鉴权，并修改默认密码。

## 后端说明

当前数据读写和图片上传仍使用 Base44。实体定义位于 `base44/entities/`，前端客户端位于 `src/api/base44Client.js`。

修改实体后，需要同步 Base44 后端配置：

```bash
npx base44 entities push
```

`.env.local` 只用于本地配置，已被 Git 忽略，请勿提交密钥或访问令牌。
