import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  const url = new URL(raw);
  const adapter = new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ""),
    connectionLimit: 10,
    // MySQL 8's default auth plugin needs this over a non-TLS local connection. Dev only.
    allowPublicKeyRetrieval: process.env.NODE_ENV !== "production",
  });
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient = g.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
