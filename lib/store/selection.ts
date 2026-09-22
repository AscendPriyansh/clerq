"use client";
import { create } from "zustand";
type Pair = { receiptId?: string; bankTransactionId?: string };
export const useSelection = create<{ selections: Record<string, Pair>; select: (orgSlug: string, value: Pair) => void; clear: (orgSlug: string) => void }>(set => ({
  selections: {},
  select: (orgSlug, value) => set(state => ({ selections: { ...state.selections, [orgSlug]: { ...state.selections[orgSlug], ...value } } })),
  clear: orgSlug => set(state => ({ selections: { ...state.selections, [orgSlug]: {} } })),
}));
