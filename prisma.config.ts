import { loadEnvConfig } from "@next/env";
import { defineConfig } from "prisma/config";
loadEnvConfig(process.cwd());
export default defineConfig({ schema: "prisma/schema.prisma", migrations: { seed: "node --conditions=react-server --import tsx prisma/seed.ts" } });
