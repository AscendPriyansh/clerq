import "server-only";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET } from "./service";

// Signed upload URLs expire in two hours. Leave a full day for completion/retries.
export async function cleanupStagingUploads(now = new Date()) {
  const storage = createAdminClient().storage.from(BUCKET);
  const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
  let removed = 0;
  let cursor: string | undefined;
  async function list(prefix: string) {
    const entries = [];
    for (let offset = 0; ; offset += 100) {
      const { data, error } = await storage.list(prefix, { limit: 100, offset, sortBy: { column: "name", order: "asc" } });
      if (error || !data) throw new Error("STAGING_LIST_FAILED");
      entries.push(...data);
      if (data.length < 100) return entries;
    }
  }
  do {
    const organisations = await prisma.organization.findMany({
      where: cursor ? { id: { gt: cursor } } : {},
      orderBy: { id: "asc" }, take: 100, select: { id: true },
    });
    for (const org of organisations) {
      const prefix = `${org.id}/staging`;
      for (const user of await list(prefix)) {
        if (user.id || !/^[0-9a-f-]{36}$/.test(user.name)) continue;
        const userPrefix = `${prefix}/${user.name}`;
        // Finish listing before deleting, otherwise offset pagination skips files.
        const stale = (await list(userPrefix)).filter(file => file.id
          && /^[0-9a-f-]{36}\.(pdf|png|jpg|webp)$/.test(file.name)
          && Date.parse(file.updated_at || file.created_at || "") < cutoff);
        for (let index = 0; index < stale.length; index += 100) {
          const paths = stale.slice(index, index + 100).map(file => `${userPrefix}/${file.name}`);
          const { error } = await storage.remove(paths);
          if (error) throw new Error("STAGING_CLEANUP_FAILED");
          removed += paths.length;
        }
      }
    }
    if (organisations.length < 100) return removed;
    cursor = organisations[organisations.length - 1].id;
  } while (true);
}
