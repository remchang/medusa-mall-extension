import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"

/**
 * 收藏夹 API 集成测试。
 *
 * 覆盖实验要求里的「API 测试」和「业务边界测试」两类：
 *  - 状态码正确（201 / 200 / 400 / 401 / 403 / 404）
 *  - 幂等：重复收藏不新增记录
 *  - 越权：不能取消别人的收藏
 *  - 空数据：没有收藏时返回空数组而不是报错
 *
 * 运行方式（在 apps/backend 目录）：
 *   pnpm test:integration:http
 */
jest.setTimeout(60 * 1000)

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    describe("收藏夹 API", () => {
      let kehuToken: string
      let kehuId: string
      let lingyigeToken: string
      let shangpinId: string

      beforeAll(async () => {
        const container = getContainer()
        const authModule = container.resolve(Modules.AUTH)

        // ---------- 准备两个客户，用于验证越权 ----------
        const zhuce = async (email: string, password: string) => {
          const jieGuo = await authModule.register("emailpass", {
            body: { email, password },
          })
          const denglu = await authModule.authenticate("emailpass", {
            body: { email, password },
          })
          return { token: jieGuo.authIdentityId!, jwt: denglu.authIdentityId! }
        }

        // 直接用 auth 模块注册，避免依赖邮件验证流程
        await zhuce("shoucang-a@test.local", "password123")
        await zhuce("shoucang-b@test.local", "password123")

        // 用 API 走一遍注册 + 登录，拿到真正可用的 JWT
        const zhuCeA = await api.post("/auth/customer/emailpass/register", {
          email: "shoucang-a@test.local",
          password: "password123",
        })
        kehuToken = zhuCeA.data.token

        // 创建客户记录
        const jianKehuA = await api.post(
          "/store/customers",
          { email: "shoucang-a@test.local" },
          { headers: { authorization: `Bearer ${kehuToken}` } }
        )
        kehuId = jianKehuA.data.customer.id

        const zhuCeB = await api.post("/auth/customer/emailpass/register", {
          email: "shoucang-b@test.local",
          password: "password123",
        })
        lingyigeToken = zhuCeB.data.token
        await api.post(
          "/store/customers",
          { email: "shoucang-b@test.local" },
          { headers: { authorization: `Bearer ${lingyigeToken}` } }
        )

        // 重新登录拿到绑定了客户身份的 token
        const dengluA = await api.post("/auth/customer/emailpass", {
          email: "shoucang-a@test.local",
          password: "password123",
        })
        kehuToken = dengluA.data.token

        const dengluB = await api.post("/auth/customer/emailpass", {
          email: "shoucang-b@test.local",
          password: "password123",
        })
        lingyigeToken = dengluB.data.token

        // ---------- 准备一个可收藏的商品 ----------
        const { data: xiaoShouQuDao } = await api.get(
          "/admin/sales-channels?limit=1",
          { headers: { "x-medusa-access-token": process.env.ADMIN_TOKEN! } }
        )

        // 用直接查库的方式取一个已有的商品 ID，避免依赖管理端鉴权
        const query = container.resolve("query")
        const { data: shangpinList } = await query.graph({
          entity: "product",
          fields: ["id"],
        })

        if (shangpinList.length) {
          shangpinId = shangpinList[0].id
        } else {
          shangpinId = "prod_placeholder"
        }
      })

      describe("POST /store/shoucang", () => {
        it("未登录时返回 401", async () => {
          const res = await api.post("/store/shoucang", {
            shangpin_id: shangpinId,
          })

          expect(res.status).toBe(401)
          expect(res.data.message).toContain("登录")
        })

        it("缺少 shangpin_id 时返回 400", async () => {
          const res = await api
            .post(
              "/store/shoucang",
              {},
              { headers: { authorization: `Bearer ${kehuToken}` } }
            )
            .catch((e) => e.response)

          expect(res.status).toBe(400)
        })

        it("收藏不存在的商品返回 400", async () => {
          const res = await api
            .post(
              "/store/shoucang",
              { shangpin_id: "prod_buzhende" },
              { headers: { authorization: `Bearer ${kehuToken}` } }
            )
            .catch((e) => e.response)

          expect(res.status).toBe(400)
        })

        it("正常收藏返回 201 且 yiyoucunzai 为 false", async () => {
          const res = await api.post(
            "/store/shoucang",
            { shangpin_id: shangpinId, beizhu: "等降价" },
            { headers: { authorization: `Bearer ${kehuToken}` } }
          )

          expect(res.status).toBe(201)
          expect(res.data.yiyoucunzai).toBe(false)
          expect(res.data.shoucang.shangpin_id).toBe(shangpinId)
          expect(res.data.shoucang.beizhu).toBe("等降价")
        })

        // 这是幂等性的核心断言：重复收藏不产生第二条记录
        it("重复收藏返回 200 且不新增记录", async () => {
          const res = await api.post(
            "/store/shoucang",
            { shangpin_id: shangpinId },
            { headers: { authorization: `Bearer ${kehuToken}` } }
          )

          expect(res.status).toBe(200)
          expect(res.data.yiyoucunzai).toBe(true)

          const chaXun = await api.get("/store/shoucang", {
            headers: { authorization: `Bearer ${kehuToken}` },
          })

          const tongkuanJiLu = chaXun.data.shoucang.filter(
            (t: any) => t.shangpin_id === shangpinId
          )
          expect(tongkuanJiLu.length).toBe(1)
        })
      })

      describe("GET /store/shoucang", () => {
        it("未登录返回 401", async () => {
          const res = await api
            .get("/store/shoucang")
            .catch((e) => e.response)

          expect(res.status).toBe(401)
        })

        it("返回当前客户的收藏，且带商品信息", async () => {
          const res = await api.get("/store/shoucang", {
            headers: { authorization: `Bearer ${kehuToken}` },
          })

          expect(res.status).toBe(200)
          expect(Array.isArray(res.data.shoucang)).toBe(true)
          expect(res.data.shoucang.length).toBeGreaterThan(0)

          const diYiTiao = res.data.shoucang[0]
          expect(diYiTiao).toHaveProperty("shangpin")
          expect(diYiTiao.shangpin).toHaveProperty("title")
        })

        it("另一个客户看不到别人的收藏", async () => {
          const res = await api.get("/store/shoucang", {
            headers: { authorization: `Bearer ${lingyigeToken}` },
          })

          expect(res.status).toBe(200)
          // B 没有收藏过任何东西
          expect(res.data.shoucang.length).toBe(0)
          expect(res.data.zongshu).toBe(0)
        })
      })

      describe("DELETE /store/shoucang/:id", () => {
        it("删除不存在的记录返回 404", async () => {
          const res = await api
            .delete("/store/shoucang/sc_buzhende", {
              headers: { authorization: `Bearer ${kehuToken}` },
            })
            .catch((e) => e.response)

          expect(res.status).toBe(404)
        })

        it("不能删除他人的收藏，返回 403", async () => {
          const chaXun = await api.get("/store/shoucang", {
            headers: { authorization: `Bearer ${kehuToken}` },
          })
          const aDeJiLu = chaXun.data.shoucang[0]

          const res = await api
            .delete(`/store/shoucang/${aDeJiLu.id}`, {
              headers: { authorization: `Bearer ${lingyigeToken}` },
            })
            .catch((e) => e.response)

          expect(res.status).toBe(403)

          // 确认这条记录还在
          const chaXunHou = await api.get("/store/shoucang", {
            headers: { authorization: `Bearer ${kehuToken}` },
          })
          expect(
            chaXunHou.data.shoucang.some((t: any) => t.id === aDeJiLu.id)
          ).toBe(true)
        })

        it("本人删除成功，返回 200 且记录消失", async () => {
          const chaXun = await api.get("/store/shoucang", {
            headers: { authorization: `Bearer ${kehuToken}` },
          })
          const muBiao = chaXun.data.shoucang[0]

          const res = await api.delete(`/store/shoucang/${muBiao.id}`, {
            headers: { authorization: `Bearer ${kehuToken}` },
          })

          expect(res.status).toBe(200)
          expect(res.data.deleted).toBe(true)

          const chaXunHou = await api.get("/store/shoucang", {
            headers: { authorization: `Bearer ${kehuToken}` },
          })
          expect(
            chaXunHou.data.shoucang.some((t: any) => t.id === muBiao.id)
          ).toBe(false)
        })

        it("重复删除同一条记录返回 404", async () => {
          // 先建一条
          const jian = await api.post(
            "/store/shoucang",
            { shangpin_id: shangpinId },
            { headers: { authorization: `Bearer ${kehuToken}` } }
          )
          const jiLuId = jian.data.shoucang.id

          // 第一次删除
          await api.delete(`/store/shoucang/${jiLuId}`, {
            headers: { authorization: `Bearer ${kehuToken}` },
          })

          // 第二次删除
          const res = await api
            .delete(`/store/shoucang/${jiLuId}`, {
              headers: { authorization: `Bearer ${kehuToken}` },
            })
            .catch((e) => e.response)

          expect(res.status).toBe(404)
        })
      })
    })
  },
})
