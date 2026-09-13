import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260913103201 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "shoucang_item" ("id" text not null, "kehu_id" text not null, "shangpin_id" text not null, "beizhu" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "shoucang_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_shoucang_item_deleted_at" ON "shoucang_item" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "shoucang_item" cascade;`);
  }

}
