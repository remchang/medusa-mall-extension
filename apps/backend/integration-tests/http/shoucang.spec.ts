import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { zhunbei_shangpin } from "../shouce-zhong-shangpin"

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
  testSuite: ({ api, getContainer, dbUtils }) => {
    describe("收藏夹 API", () => {
      let kehuToken: string
      let kehuId: string
      let lingyigeToken: string
      let shangpinId: string
      let key: string

      // Medusa 2.x 的 store 端点统一要求带 publishable key，
      // 少带会在中间件层直接返回 400，到不了路由里。
      // 所有 store 请求都通过它补上这个头。
      const qingqiu = (token?: string) => {
        const headers: Record<string, string> = {
          "x-publishable-api-key": key,
        }
        if (token) {
          headers.authorization = `Bearer ${token}`
        }
        return { headers }
      }

      beforeAll(async () => {
        const container = getContainer()

        // ---------- 造数据 ----------
        // 临时测试库是空的，先把商品补上（渠道、配送模板由基线种子提供）。
        await zhunbei_shangpin(container)

        // ---------- 取一个 publishable key ----------
        const keyModule = container.resolve(Modules.API_KEY)
        let keys = await keyModule.listApiKeys({ type: "publishable" })

        // 基线种子脚本会建发布密钥，但它在临时测试库里不一定会被执行，
        // 所以这里做一层兜底：没有就自己建一个。
        if (!keys.length) {
          const channels = await container
            .resolve("query")
            .graph({ entity: "sales_channel", fields: ["id"] })
          keys = [
            await keyModule.createApiKeys({
              title: "测试用发布密钥",
              type: "publishable",
            }),
          ]
          await keyModule.linkSalesChannelsToApiKeys(keys[0].id, {
            sales_channel_id: channels.data.map((c: any) => c.id),
          })
        }
        key = keys[0].token

        // ---------- 准备两个客户，用于验证越权 ----------
        // 走标准的客户注册链路：
        //   1) /auth/customer/emailpass/register 建身份，拿到"待绑定"的 token
        //   2) 带这个 token 调 /store/customers 建客户档案，token 与客户完成绑定
        //   3) 重新登录拿一个已绑定客户的 token，后续请求都带上它
        const zhuceBingDenglu = async (email: string) => {
          const miMa = "password123"

          const zhuCe = await api.post("/auth/customer/emailpass/register", {
            email,
            password: miMa,
          })

          const jianKehu = await api.post(
            "/store/customers",
            { email },
            qingqiu(zhuCe.data.token)
          )

          const denglu = await api.post("/auth/customer/emailpass", {
            email,
            password: miMa,
          })

          return {
            kehuId: jianKehu.data.customer.id,
            token: denglu.data.token,
          }
        }

        const jia = await zhuceBingDenglu("shoucang-a@test.local")
        kehuId = jia.kehuId
        kehuToken = jia.token

        const yi = await zhuceBingDenglu("shoucang-b@test.local")
        lingyigeToken = yi.token

        // ---------- 准备一个可收藏的商品 ----------
        // 商品刚由本文件的种子逻辑造出来，这里只需要取出它的 ID。
        // 不硬编码 ID，是因为临时测试库每次跑都是新的。
        const query = container.resolve("query")
        const { data: shangpinList } = await query.graph({
          entity: "product",
          fields: ["id"],
        })

        if (!shangpinList.length) {
          throw new Error("测试库里没有商品，无法验证收藏功能")
        }
        shangpinId = shangpinList[0].id

        // 把「带商品、带发布密钥、带客户」的这份干净状态存成快照。
        // 之后每个用例跑完都会还原到这份快照，用例之间彼此隔离。
        //
        // 正因为有还原，用例不能依赖「上一个用例留下的收藏记录」，
        // 每个用例都要自己造需要的数据，不能靠执行顺序。
        await dbUtils.snapshot({})
      })

      describe("POST /store/shoucang", () => {
        it("未登录时返回 401", async () => {
          const res = await api
            .post("/store/shoucang", { shangpin_id: shangpinId }, qingqiu())
            .catch((e) => e.response)

          expect(res.status).toBe(401)
          expect(res.data.message).toContain("登录")
        })

        it("缺少 shangpin_id 时返回 400", async () => {
          const res = await api
            .post("/store/shoucang", {}, qingqiu(kehuToken))
            .catch((e) => e.response)

          expect(res.status).toBe(400)
        })

        it("收藏不存在的商品返回 400", async () => {
          const res = await api
            .post(
              "/store/shoucang",
              { shangpin_id: "prod_buzhende" },
              qingqiu(kehuToken)
            )
            .catch((e) => e.response)

          expect(res.status).toBe(400)
        })

        it("正常收藏返回 201 且 yiyoucunzai 为 false", async () => {
          const res = await api.post(
            "/store/shoucang",
            { shangpin_id: shangpinId, beizhu: "等降价" },
            qingqiu(kehuToken)
          )

          expect(res.status).toBe(201)
          expect(res.data.yiyoucunzai).toBe(false)
          expect(res.data.shoucang.shangpin_id).toBe(shangpinId)
          expect(res.data.shoucang.beizhu).toBe("等降价")
        })

        // 这是幂等性的核心断言：重复收藏不产生第二条记录
        it("重复收藏返回 200 且不新增记录", async () => {
          // 先收藏一次（用例之间数据库会还原，不能复用别的用例的数据）
          await api.post(
            "/store/shoucang",
            { shangpin_id: shangpinId },
            qingqiu(kehuToken)
          )

          // 再收藏一次，这次应该命中「已存在」分支
          const res = await api.post(
            "/store/shoucang",
            { shangpin_id: shangpinId },
            qingqiu(kehuToken)
          )

          expect(res.status).toBe(200)
          expect(res.data.yiyoucunzai).toBe(true)

          const chaXun = await api.get(
            "/store/shoucang",
            qingqiu(kehuToken)
          )

          const tongkuanJiLu = chaXun.data.shoucang.filter(
            (t: any) => t.shangpin_id === shangpinId
          )
          expect(tongkuanJiLu.length).toBe(1)
        })
      })

      describe("GET /store/shoucang", () => {
        it("未登录返回 401", async () => {
          const res = await api
            .get("/store/shoucang", qingqiu())
            .catch((e) => e.response)

          expect(res.status).toBe(401)
        })

        it("返回当前客户的收藏，且带商品信息", async () => {
          // 先造一条收藏，否则还原之后收藏夹是空的
          await api.post(
            "/store/shoucang",
            { shangpin_id: shangpinId },
            qingqiu(kehuToken)
          )

          const res = await api
            .get("/store/shoucang", qingqiu(kehuToken))
            .catch((e) => e.response)

          expect(res.status).toBe(200)
          expect(Array.isArray(res.data.shoucang)).toBe(true)
          expect(res.data.shoucang.length).toBeGreaterThan(0)

          const diYiTiao = res.data.shoucang[0]
          expect(diYiTiao).toHaveProperty("shangpin")
          expect(diYiTiao.shangpin).toHaveProperty("title")
        })

        it("另一个客户看不到别人的收藏", async () => {
          const res = await api.get(
            "/store/shoucang",
            qingqiu(lingyigeToken)
          )

          expect(res.status).toBe(200)
          // B 没有收藏过任何东西
          expect(res.data.shoucang.length).toBe(0)
          expect(res.data.zongshu).toBe(0)
        })
      })

      describe("DELETE /store/shoucang/:id", () => {
        it("删除不存在的记录返回 404", async () => {
          const res = await api
            .delete("/store/shoucang/sc_buzhende", qingqiu(kehuToken))
            .catch((e) => e.response)

          expect(res.status).toBe(404)
        })

        it("不能删除他人的收藏，返回 403", async () => {
          // A 先收藏一条
          await api.post(
            "/store/shoucang",
            { shangpin_id: shangpinId },
            qingqiu(kehuToken)
          )

          const chaXun = await api.get("/store/shoucang", qingqiu(kehuToken))
          const aDeJiLu = chaXun.data.shoucang[0]

          const res = await api
            .delete(
              `/store/shoucang/${aDeJiLu.id}`,
              qingqiu(lingyigeToken)
            )
            .catch((e) => e.response)

          expect(res.status).toBe(403)

          // 确认这条记录还在
          const chaXunHou = await api.get(
            "/store/shoucang",
            qingqiu(kehuToken)
          )
          expect(
            chaXunHou.data.shoucang.some((t: any) => t.id === aDeJiLu.id)
          ).toBe(true)
        })

        it("本人删除成功，返回 200 且记录消失", async () => {
          // A 先收藏一条
          await api.post(
            "/store/shoucang",
            { shangpin_id: shangpinId },
            qingqiu(kehuToken)
          )

          const chaXun = await api.get("/store/shoucang", qingqiu(kehuToken))
          const muBiao = chaXun.data.shoucang[0]

          const res = await api.delete(
            `/store/shoucang/${muBiao.id}`,
            qingqiu(kehuToken)
          )

          expect(res.status).toBe(200)
          expect(res.data.deleted).toBe(true)

          const chaXunHou = await api.get(
            "/store/shoucang",
            qingqiu(kehuToken)
          )
          expect(
            chaXunHou.data.shoucang.some((t: any) => t.id === muBiao.id)
          ).toBe(false)
        })

        it("重复删除同一条记录返回 404", async () => {
          // 先建一条
          const jian = await api.post(
            "/store/shoucang",
            { shangpin_id: shangpinId },
            qingqiu(kehuToken)
          )
          const jiLuId = jian.data.shoucang.id

          // 第一次删除
          await api.delete(`/store/shoucang/${jiLuId}`, qingqiu(kehuToken))

          // 第二次删除
          const res = await api
            .delete(`/store/shoucang/${jiLuId}`, qingqiu(kehuToken))
            .catch((e) => e.response)

          expect(res.status).toBe(404)
        })
      })
    })
  },
})
