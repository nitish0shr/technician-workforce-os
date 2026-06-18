import React, { useMemo, useState } from "react";
import {
  flexRender, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  useReactTable, ColumnDef, SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import { classNames as cx } from "../lib/format";
import { EmptyState } from "./primitives";

export interface Col<T> {
  id: string;
  header: string;
  accessor?: (row: T) => any;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  width?: number | string;
  className?: string;
}

export function DataTable<T extends object>({
  data, columns, initialSort, onRowClick, search = true, searchPlaceholder = "Filter…",
  rightSlot, dense, emptyTitle = "No records", getRowId,
}: {
  data: T[];
  columns: Col<T>[];
  initialSort?: SortingState;
  onRowClick?: (row: T) => void;
  search?: boolean;
  searchPlaceholder?: string;
  rightSlot?: React.ReactNode;
  dense?: boolean;
  emptyTitle?: string;
  getRowId?: (row: T) => string;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSort || []);
  const [globalFilter, setGlobalFilter] = useState("");

  const cols = useMemo<ColumnDef<T>[]>(
    () =>
      columns.map((c) => ({
        id: c.id,
        header: c.header,
        accessorFn: (row: T) => (c.accessor ? c.accessor(row) : (row as any)[c.id]),
        cell: (info) => (c.cell ? c.cell(info.row.original) : (info.getValue() as React.ReactNode)),
        enableSorting: c.sortable !== false,
        meta: { align: c.align, className: c.className, width: c.width },
      })),
    [columns]
  );

  const table = useReactTable({
    data,
    columns: cols,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <div className="flex flex-col">
      {(search || rightSlot) && (
        <div className="mb-3 flex items-center gap-2">
          {search && (
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
              <input
                className="input pl-8"
                placeholder={searchPlaceholder}
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
              />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">{rightSlot}</div>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-line bg-canvas">
                {hg.headers.map((h) => {
                  const meta: any = h.column.columnDef.meta || {};
                  const sorted = h.column.getIsSorted();
                  const canSort = h.column.getCanSort();
                  return (
                    <th
                      key={h.id}
                      style={{ width: meta.width }}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : canSort ? "none" : undefined}
                      tabIndex={canSort ? 0 : undefined}
                      onKeyDown={canSort ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); h.column.toggleSorting(); } } : undefined}
                      className={cx(
                        "select-none px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint",
                        meta.align === "right" ? "text-right" : meta.align === "center" ? "text-center" : "text-left",
                        canSort && "cursor-pointer hover:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-inset"
                      )}
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      <span className={cx("inline-flex items-center gap-1", meta.align === "right" && "flex-row-reverse")}>
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getCanSort() &&
                          (sorted === "asc" ? <ArrowUp className="h-3 w-3" /> : sorted === "desc" ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />)}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={getRowId ? getRowId(r.original) : r.id}
                tabIndex={onRowClick ? 0 : undefined}
                role={onRowClick ? "button" : undefined}
                onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRowClick(r.original); } } : undefined}
                className={cx("border-b border-line-soft last:border-0", onRowClick && "cursor-pointer row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-inset")}
                onClick={() => onRowClick?.(r.original)}
              >
                {r.getVisibleCells().map((cell) => {
                  const meta: any = cell.column.columnDef.meta || {};
                  return (
                    <td
                      key={cell.id}
                      className={cx(
                        dense ? "px-3 py-1.5" : "px-3 py-2.5",
                        "align-middle text-ink",
                        meta.align === "right" ? "text-right" : meta.align === "center" ? "text-center" : "text-left",
                        meta.className
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="p-6">
            <EmptyState title={emptyTitle} hint="Try clearing the filter or adjusting your data." />
          </div>
        )}
      </div>
    </div>
  );
}
