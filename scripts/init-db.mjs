import { PrismaClient } from "../src/generated/prisma/index.js";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../dev.db");

const adapter = new PrismaLibSql({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.user.findUnique({ where: { username: "root" } });
  if (existing) {
    console.log("root 用户已存在，跳过初始化");
    return;
  }
  const hashed = await bcrypt.hash("root", 10);
  await prisma.user.create({
    data: { username: "root", password: hashed, role: "OWNER" },
  });
  console.log("已创建 root 用户（密码: root）");
  console.log("请登录后立即修改密码！");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
