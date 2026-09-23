"use client";
import { useMemo } from "react";
import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";

export function DataTable<T extends { id: string }>({ rows, columns, selectedId, onSelect, serverPaginated = false }: { serverPaginated?: boolean; rows: T[]; columns: ColumnDef<T>[]; selectedId?: string; onSelect: (row: T) => void }) {
  const data = useMemo(() => rows, [rows]);
  // TanStack exposes mutable table APIs intentionally; do not compiler-memoise.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({ data, columns, getCoreRowModel: getCoreRowModel(), getPaginationRowModel: getPaginationRowModel(), manualPagination: serverPaginated, getRowId: row => row.id, initialState: { pagination: { pageSize: 20 } } });
  return <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead>{table.getHeaderGroups().map(group => <tr key={group.id}><th className="p-2">Select</th>{group.headers.map(header => <th className="border-b p-2" key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead><tbody>{table.getRowModel().rows.map(row => <tr key={row.id} className={row.id === selectedId ? "bg-muted" : ""} onClick={() => onSelect(row.original)}><td className="p-2"><button aria-label={`Select row ${row.index + 1}`} aria-pressed={row.id === selectedId} className="rounded border px-2 py-1" onClick={event => { event.stopPropagation(); onSelect(row.original); }}>{row.id === selectedId ? "✓" : "Select"}</button></td>{row.getVisibleCells().map(cell => <td key={cell.id} className="border-b p-2">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)}</tbody></table></div>{!serverPaginated && <div className="flex items-center gap-3 py-2"><Button variant="outline" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>Previous</Button><span>Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}</span><Button variant="outline" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>Next</Button></div>}{!rows.length && <p>No records match this filter.</p>}</>;
}
