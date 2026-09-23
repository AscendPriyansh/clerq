import { pageNumber, pageHref } from "@/lib/pagination";
test.each([undefined, "-1", "0", "1.5", "NaN", "Infinity"])("invalid page %s starts at page one", value => {
  expect(pageNumber(value)).toBe(1);
});
test("page navigation preserves filters and the other table's position", () => {
  const url = pageHref("/dashboard/test/reconcile", { bankStatus: "SUGGESTED", receiptPage: "3", bankPage: "1" }, "bankPage", 2);
  expect(new URL(url, "http://localhost").searchParams.get("bankStatus")).toBe("SUGGESTED");
  expect(new URL(url, "http://localhost").searchParams.get("receiptPage")).toBe("3");
  expect(new URL(url, "http://localhost").searchParams.get("bankPage")).toBe("2");
});
