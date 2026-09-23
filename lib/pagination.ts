export type PageParams = Record<string, string | string[] | undefined>;
export const PAGE_SIZE = 50;
export function pageNumber(value: string | string[] | undefined) {
  const number = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(number) && number > 0 ? Math.min(number, 100000) : 1;
}
export function pageHref(path: string, params: PageParams, key: string, page: number) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([name, value]) => { if (typeof value === "string") query.set(name, value); });
  query.set(key, String(Math.max(1, page)));
  return `${path}?${query.toString()}`;
}
