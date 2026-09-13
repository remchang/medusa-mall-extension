import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { SHOUCANG_MODULE } from './src/modules/shoucang'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  // 二次开发新增：收藏夹模块。
  // 只注册自定义模块，不动上游 Commerce Modules。
  modules: [
    {
      resolve: "./src/modules/shoucang",
      definition: {
        isQueryable: true,
      },
    },
  ],
})
