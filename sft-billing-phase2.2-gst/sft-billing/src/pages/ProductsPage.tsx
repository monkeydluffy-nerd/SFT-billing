import { useMemo, useState, useRef, useEffect } from "react";
import {
  Plus,
  Package,
  AlertTriangle,
  Pencil,
  Trash2,
  MoreHorizontal,
  ChevronDown,
  ArrowUpDown,
  Search,
  X,
  Copy,
  Tag,
  Archive,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/SkeletonLoader";
import { Toast } from "@/components/shared/Toast";
import { ProductFormPanel } from "@/components/products/ProductFormPanel";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { useCatalogProducts } from "@/hooks/useCatalogProducts";
import { useInvoices } from "@/hooks/useInvoices";
import { activeDataProvider } from "@/services";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/cn";
import type { CatalogProduct } from "@/types";

const TEST_PRODUCT_PREFIXES = ["TEST-", "TEST_", "test-", "test_"];

function formatRate(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function getGstTint(gstRate: number): string {
  const pct = Math.round(gstRate * 100);
  if (pct <= 5) return "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-success-bg dark:text-success dark:border-success/30";
  if (pct <= 12) return "bg-green-50 text-green-700 border-green-100 dark:bg-success-bg dark:text-success dark:border-success/30";
  if (pct <= 18) return "bg-amber-50 text-amber-700 border-amber-100 dark:bg-caution-bg dark:text-caution dark:border-caution/30";
  if (pct <= 28) return "bg-orange-50 text-orange-700 border-orange-100 dark:bg-caution-bg dark:text-caution dark:border-caution/30";
  return "bg-violet-50 text-violet-700 border-violet-100 dark:bg-neutral-bg dark:text-neutral dark:border-border";
}

function isTestProduct(product: { code: string; name: string }): boolean {
  return (
    TEST_PRODUCT_PREFIXES.some((prefix) => product.code.toUpperCase().startsWith(prefix)) ||
    TEST_PRODUCT_PREFIXES.some((prefix) => product.name.toUpperCase().startsWith(prefix))
  );
}

export function ProductsPage() {
  const { data: products, loading, error, reload } = useCatalogProducts();
  const { data: invoices } = useInvoices();

  const [query, setQuery] = useState("");
  const [formProduct, setFormProduct] = useState<CatalogProduct | null | undefined>(undefined);
  const [duplicateProduct, setDuplicateProduct] = useState<CatalogProduct | undefined>(undefined);
  const [deleteProduct, setDeleteProduct] = useState<CatalogProduct | null>(null);
  const [archiveProduct, setArchiveProduct] = useState<CatalogProduct | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);
  const [showTestItems, setShowTestItems] = useState(false);
  const [sortBy, setSortBy] = useState<"code" | "name" | "price" | "recent">("code");
  const [gstFilter, setGstFilter] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"none" | "alpha">("none");
  const actionMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionMenuOpen && actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        setActionMenuOpen(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [actionMenuOpen]);

  const filteredProducts = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    const result = (products ?? []).filter((product) => {
      // Hide archived products from the main list
      if (product.isArchived) return false;
      const matchesSearch =
        !search ||
        product.code.toLocaleLowerCase().includes(search) ||
        product.name.toLocaleLowerCase().includes(search) ||
        product.hsnCode.toLocaleLowerCase().includes(search);
      const matchesTestFilter = showTestItems || !isTestProduct(product);
      // gstFilter is a string like "18" (percentage), product.defaultGstRate is decimal like 0.18
      const matchesGstFilter = gstFilter === null || Math.round(product.defaultGstRate * 100) === Number(gstFilter);
      return matchesSearch && matchesTestFilter && matchesGstFilter;
    });

    switch (sortBy) {
      case "code":
        // Sort numerically by SFT code suffix (SFT-001, SFT-002, etc.)
        result.sort((a, b) => {
          const aNum = parseInt(a.code.replace("SFT-", ""), 10) || 0;
          const bNum = parseInt(b.code.replace("SFT-", ""), 10) || 0;
          return aNum - bNum;
        });
        break;
      case "price":
        result.sort((a, b) => b.defaultUnitPrice - a.defaultUnitPrice);
        break;
      case "recent":
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      default:
        result.sort((a, b) => a.name.localeCompare(b.name));
    }
    return result;
  }, [products, query, showTestItems, sortBy, gstFilter]);

  // Group products for grouped view
  const groupedProducts = useMemo(() => {
    if (groupBy === "none") return [{ group: "All", products: filteredProducts }];

    const groups = new Map<string, typeof filteredProducts>();
    for (const product of filteredProducts) {
      let key: string;
      key = product.name.charAt(0).toUpperCase();
      if (!/[A-Z0-9]/.test(key)) key = "#";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(product);
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, products]) => ({ group, products }));
  }, [filteredProducts, groupBy]);

  // Compute invoice usage count for each product
  const invoiceUsageCount = useMemo(() => {
    const counts = new Map<string, number>();
    if (invoices) {
      for (const invoice of invoices) {
        if (invoice.isDraft) continue;
        for (const item of invoice.items) {
          if (item.productId) {
            counts.set(item.productId, (counts.get(item.productId) || 0) + 1);
          }
        }
      }
    }
    return counts;
  }, [invoices]);

  // Summary stats
  const summary = useMemo(() => {
    const allProducts = products ?? [];
    const activeProducts = allProducts.filter((p) => p.isActive && !p.isArchived);
    const totalProducts = activeProducts.length;
    const testItemsHidden = allProducts.filter(isTestProduct).length;
    
    // Products used in invoices
    const usedInInvoices = new Set<string>();
    if (invoices) {
      for (const invoice of invoices) {
        if (invoice.isDraft) continue;
        for (const item of invoice.items) {
          if (item.productId) usedInInvoices.add(item.productId);
        }
      }
    }
    const productsUsedCount = usedInInvoices.size;

    // Top billed product
    let topBilledProduct: { name: string; code: string; count: number } | null = null;
    if (invoices) {
      const productCounts = new Map<string, number>();
      for (const invoice of invoices) {
        if (invoice.isDraft) continue;
        for (const item of invoice.items) {
          if (item.productId) {
            productCounts.set(item.productId, (productCounts.get(item.productId) || 0) + 1);
          }
        }
      }
      let maxCount = 0;
      for (const [pid, count] of productCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          const prod = allProducts.find((p) => p.id === pid);
          if (prod) topBilledProduct = { name: prod.name, code: prod.code, count: maxCount };
        }
      }
    }

    // Needs attention: missing HSN, price 0, or missing code
    const needsAttentionCount = activeProducts.filter((p) => 
      !p.hsnCode || p.defaultUnitPrice <= 0 || !p.code
    ).length;

    return { 
      totalProducts, 
      testItemsHidden,
      topBilledProduct,
      needsAttentionCount,
      productsUsedCount 
    };
  }, [products, invoices]);

  // GST and HSN options for filters (respect test items toggle)
  const gstOptions = useMemo(() => {
    const baseProducts = showTestItems ? products ?? [] : (products ?? []).filter((p) => !isTestProduct(p));
    const rates = new Set(baseProducts.map((p) => Math.round(p.defaultGstRate * 100)));
    return Array.from(rates).sort((a, b) => a - b);
  }, [products, showTestItems]);

  function handleProductSaved() {
    const wasEditing = formProduct !== null;
    setFormProduct(undefined);
    setDuplicateProduct(undefined);
    reload();
    setToast(wasEditing ? "Product updated" : "Product added");
  }

  async function confirmDelete() {
    if (!deleteProduct || deletePending) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      await activeDataProvider.deleteCatalogProduct(deleteProduct.id);
      setToast(`${deleteProduct.code} — ${deleteProduct.name} deleted`);
      setDeleteProduct(null);
      reload();
    } catch (requestError) {
      setDeleteError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't delete product.",
      );
    } finally {
      setDeletePending(false);
    }
  }

  async function confirmArchive() {
    if (!archiveProduct || deletePending) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      await activeDataProvider.setCatalogProductArchived(archiveProduct.id, true);
      setToast(`${archiveProduct.code} — ${archiveProduct.name} archived`);
      setArchiveProduct(null);
      reload();
    } catch (requestError) {
      setDeleteError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't archive product.",
      );
    } finally {
      setDeletePending(false);
    }
  }

  const totalProducts = products?.length ?? 0;
  const testItemsCount = products?.filter(isTestProduct).length ?? 0;
  const visibleProducts = filteredProducts.length;
  const activeProductsCount = products?.filter((p) => p.isActive && !p.isArchived).length ?? 0;
  
  // Base count for display: when test items hidden, show active products; when shown, show all
  const baseProductCount = showTestItems ? totalProducts : activeProductsCount;
  const baseProductLabel = showTestItems ? "products" : "active products";

  if (error) {
    return (
      <div>
        <PageHeader title="Products" subtitle="Manage your product catalogue" />
        <div className="px-10 py-10">
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load products"
            description={error.message}
            action={
              <Button variant="secondary" onClick={reload}>
                Retry
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full pb-24">
      <PageHeader
        title="Products"
        subtitle="Manage your product catalogue"
        action={
          <Button onClick={() => { setDuplicateProduct(undefined); setFormProduct(null); }}>
            <Plus size={15} aria-hidden /> Add product
          </Button>
        }
      />

      {/* Summary Strip */}
      <div className="mb-6 px-4 sm:px-10 grid grid-cols-1 gap-4 sm:grid-cols-3 items-stretch" role="region" aria-label="Product summary">
        <div className="rounded-lg border border-border bg-surface p-5 shadow-card hover:shadow-float transition-shadow duration-micro min-h-[110px] flex flex-col">
          <div className="text-3xl font-bold text-ink tracking-tight font-tabular">{summary.totalProducts}</div>
          <div className="mt-1 text-sm text-ink-muted">Total products</div>
          <div className="mt-0.5 text-xs text-ink-faint">{activeProductsCount} active · {summary.testItemsHidden} test items hidden</div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-card hover:shadow-float transition-shadow duration-micro min-h-[110px] flex flex-col">
          {/* Top billed product - CODE as chip, name below */}
          {summary.topBilledProduct ? (
            <>
              <div className="text-3xl font-bold text-primary font-tabular min-h-[48px] flex items-end">
                <span
                  className="inline-flex items-center px-2 py-1 rounded text-[20px] font-mono text-primary bg-primary/10 border border-primary/20 max-w-full truncate"
                  title={summary.topBilledProduct.name}
                >
                  {summary.topBilledProduct.code}
                </span>
              </div>
              <div className="mt-1.5 text-[13px] text-ink-muted truncate" title={summary.topBilledProduct.name}>
                {summary.topBilledProduct.name}
              </div>
              <div className="mt-1 text-xs text-ink-faint">
                used in {summary.topBilledProduct.count} invoice{summary.topBilledProduct.count !== 1 ? 's' : ''}
              </div>
            </>
          ) : (
            <>
              <div className="text-3xl font-bold text-primary font-tabular min-h-[48px] flex items-end">—</div>
              <div className="mt-1 text-sm text-ink-muted">Top billed product</div>
              <div className="mt-0.5 text-xs text-ink-faint">No invoice data</div>
            </>
          )}
        </div>
        <div className="rounded-lg border border-border bg-surface p-5 shadow-card hover:shadow-float transition-shadow duration-micro relative overflow-hidden min-h-[110px] flex flex-col">
          <div className="absolute inset-0 bg-gradient-to-r from-premium/5 to-transparent" aria-hidden="true" />
          <div className="relative text-3xl font-bold font-mono tracking-wide font-tabular {summary.needsAttentionCount > 0 ? 'text-overdue' : 'text-success'}">
            {summary.needsAttentionCount}
          </div>
          <div className="mt-1 text-sm text-ink-muted">Needs attention</div>
          <div className="mt-0.5 text-xs {summary.needsAttentionCount > 0 ? 'text-overdue' : 'text-success'}">
            {summary.needsAttentionCount > 0 
              ? `${summary.needsAttentionCount} product${summary.needsAttentionCount !== 1 ? 's' : ''} need review`
              : "All good"}
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 sm:px-10">
        {/* Search & Filters Bar */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between flex-wrap">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" size={16} aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by code, name, or HSN…"
              className="h-11 w-full pl-10 pr-4 rounded-md border border-border bg-surface px-4 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-border-strong transition-colors duration-micro"
              aria-label="Search products"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* GST Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by GST slab">
              <span className="text-xs text-ink-muted mr-1 hidden sm:inline">GST:</span>
              <button
                type="button"
                onClick={() => setGstFilter(null)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-micro",
                  gstFilter === null
                    ? "bg-accent text-accent-ink border-accent shadow-sm"
                    : "border-border bg-surface text-ink-muted hover:border-border-strong hover:bg-canvas",
                )}
                aria-pressed={gstFilter === null}
              >
                <span className="hidden sm:inline">All</span>
                <span className="sm:hidden">All</span>
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-tabular", gstFilter === null ? "bg-accent-ink/20" : "bg-canvas/50")}>
                  {visibleProducts}
                </span>
              </button>
              {gstOptions.map((rate) => {
                const baseProducts = showTestItems ? products ?? [] : (products ?? []).filter((p) => !isTestProduct(p));
                const count = baseProducts.filter((p) => Math.round(p.defaultGstRate * 100) === rate).length;
                return (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setGstFilter(gstFilter === String(rate) ? null : String(rate))}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-micro",
                      gstFilter === String(rate)
                        ? "bg-accent text-accent-ink border-accent shadow-sm"
                        : "border-border bg-surface text-ink-muted hover:border-border-strong hover:bg-canvas",
                    )}
                    aria-pressed={gstFilter === String(rate)}
                  >
                    {formatRate(rate / 100)}
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-tabular", gstFilter === String(rate) ? "bg-accent-ink/20" : "bg-canvas/50")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Sort Control - Custom Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setSortBy(sortBy === "code" ? "name" : sortBy === "name" ? "price" : sortBy === "price" ? "recent" : "code")}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm font-medium transition-colors duration-micro",
                  "border-border bg-surface text-ink hover:border-border-strong",
                )}
                aria-haspopup="listbox"
                aria-expanded={false}
                aria-label="Sort products"
              >
                <ArrowUpDown size={14} className="text-ink-muted" aria-hidden />
                <span className="truncate max-w-[140px]">
                  {sortBy === "code" ? "Sort: Code" : sortBy === "name" ? "Sort: Name" : sortBy === "price" ? "Sort: Price" : "Sort: Recent"}
                </span>
                <ChevronDown size={14} className="text-ink-muted" aria-hidden />
              </button>
            </div>

            {/* Sort Control - Custom Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setGroupBy(groupBy === "none" ? "alpha" : "none")}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm font-medium transition-colors duration-micro",
                  groupBy !== "none" ? "border-accent bg-accent/5 text-accent" : "border-border bg-surface text-ink hover:border-border-strong",
                )}
                aria-label="Group by"
              >
                <Tag size={14} className={groupBy !== "none" ? "text-accent" : "text-ink-muted"} aria-hidden />
                <span className="truncate max-w-[100px]">
                  {groupBy === "none" ? "No grouping" : "Group: A-Z"}
                </span>
              </button>
            </div>

            {/* Hide/Show Test Items Toggle */}
            {testItemsCount > 0 && (
              <label className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-surface text-sm text-ink-muted cursor-pointer hover:bg-canvas transition-colors duration-micro">
                <input
                  type="checkbox"
                  checked={showTestItems}
                  onChange={(e) => setShowTestItems(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent focus:ring-2"
                />
                <span className="hidden sm:inline">Show test items ({testItemsCount})</span>
                <span className="sm:hidden">Test ({testItemsCount})</span>
              </label>
            )}
          </div>
        </div>

        {/* Results Info */}
        <div className="mb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-ink-muted">
          <span className="truncate">
            {visibleProducts} of {baseProductCount} {baseProductLabel}{baseProductCount !== 1 ? "s" : ""}
            {query && ` (filtered from "${query}")`}
          </span>
          {showTestItems && testItemsCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowTestItems(false)}>
              <X size={12} aria-hidden /> Hide test items
            </Button>
          )}
        </div>

        {/* Products Table */}
        {loading ? (
          <div className="space-y-3" aria-label="Loading products">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : visibleProducts === 0 ? (
          <EmptyState
            icon={Package}
            title={baseProductCount === 0 ? "No products yet" : "No products match your filters"}
            description={
              baseProductCount === 0
                ? "Add a product to begin managing your catalogue."
                : "Try adjusting your search or filters."
            }
            action={
              baseProductCount === 0 ? (
                <Button onClick={() => { setDuplicateProduct(undefined); setFormProduct(null); }}>
                  <Plus size={15} aria-hidden /> Add product
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => { setQuery(""); setGstFilter(null); setShowTestItems(false); }}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="rounded-lg border border-border bg-surface overflow-hidden shadow-card">
            {/* Horizontal scroll wrapper for table */}
            <div className="overflow-x-auto">
              {groupedProducts.map(({ group, products: groupProducts }) => (
                <div key={group}>
                  {/* Sticky Group Header */}
                  <div className="sticky top-0 z-10 grid grid-cols-[180px_minmax(0,1fr)_110px_90px_120px] gap-4 border-b border-border bg-canvas/80 px-5 py-2.5 text-xs font-medium text-ink-faint uppercase tracking-wider backdrop-blur-sm supports-[backdrop-filter]:bg-canvas/80 min-w-[600px]">
                    <span className="truncate">Code</span>
                    <span className="truncate">Name</span>
                    <span className="text-right whitespace-nowrap">Price</span>
                    <span className="text-right whitespace-nowrap">Used</span>
                    <span className="text-right whitespace-nowrap">Actions</span>
                  </div>

                  {/* Group Rows */}
                  {groupProducts.map((product, index) => {
                    const isTest = isTestProduct(product);
                    const usageCount = invoiceUsageCount.get(product.id) ?? 0;
                    const isEven = index % 2 === 0;
                    const gstTint = getGstTint(product.defaultGstRate);
                    const gstPct = Math.round(product.defaultGstRate * 100);

                    return (
                      <div
                        key={product.id}
                        ref={actionMenuOpen === product.id ? actionMenuRef : undefined}
                        className={cn(
                          "grid grid-cols-[180px_minmax(0,1fr)_110px_90px_120px] gap-4 items-center px-5 py-3.5 transition-colors duration-micro",
                          "border-b border-border/50 last:border-b-0",
                          "hover:bg-canvas hover:shadow-sm relative cursor-pointer group",
                          "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-transparent before:transition-colors before:duration-micro",
                          "group-hover:before:bg-accent",
                          isTest && "bg-overdue/5",
                          isEven ? "bg-transparent" : "bg-canvas/30"
                        )}
                        style={{ minHeight: "60px" }}
                      >
                        {/* Code chip - starts the row */}
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="flex-shrink-0 px-2 py-0.5 rounded text-xs font-mono text-premium bg-premium/10 whitespace-nowrap truncate max-w-[170px]"
                            title={product.code}
                          >
                            {product.code}
                          </span>
                        </div>

                        {/* Name with HSN/GST subline */}
                        <div className="min-w-0 flex-1" style={{ minWidth: 0 }}>
                          <div className="truncate font-medium text-ink text-sm" title={product.name}>{product.name}</div>
                          <div className="truncate text-xs text-ink-muted flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono">HSN {product.hsnCode}</span>
                            <span aria-hidden="true">·</span>
                            <span className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                              gstTint
                            )}>
                              {gstPct}%
                            </span>
                          </div>
                        </div>

                        {/* Price - Right aligned, tabular */}
                        <div className="text-right w-28 shrink-0 font-tabular text-sm whitespace-nowrap">
                          <span className="text-ink">{formatCurrency(product.defaultUnitPrice, true)}</span>
                        </div>

                        {/* Used in invoices */}
                        <div className="text-right w-22 shrink-0 whitespace-nowrap">
                          {usageCount > 0 ? (
                            <span className="text-xs text-ink-muted font-tabular">
                              {usageCount} invoice{usageCount !== 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-ink-faint">Unused</span>
                          )}
                        </div>

                        {/* Actions Column - Edit always visible + menu */}
                        <div className="text-right w-28 shrink-0 relative whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Edit Button - ALWAYS visible */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMenuOpen(null);
                                setFormProduct(product);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-surface text-xs font-medium text-ink-muted hover:bg-canvas hover:text-ink hover:border-border-strong transition-colors duration-micro focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                              aria-label={`Edit ${product.name}`}
                            >
                              <Pencil size={12} />
                              <span className="hidden sm:inline">Edit</span>
                            </button>

                            {/* More Menu Button */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActionMenuOpen(actionMenuOpen === product.id ? null : product.id);
                                }}
                                className="p-1.5 rounded-lg bg-surface border border-border text-ink-muted hover:bg-canvas hover:text-ink hover:border-border-strong transition-colors duration-micro focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                                aria-label={`More actions for ${product.name}`}
                                aria-expanded={actionMenuOpen === product.id}
                                aria-haspopup="true"
                              >
                                <MoreHorizontal size={14} />
                              </button>

                              {actionMenuOpen === product.id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setActionMenuOpen(null)}
                                    aria-hidden="true"
                                  />
                                  <div className="absolute right-0 top-full mt-1.5 min-w-[140px] rounded-lg border border-border bg-surface-raised shadow-float-lg overflow-hidden z-20 animate-in fade-in-0 zoom-in-95 duration-micro">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActionMenuOpen(null);
                                        setFormProduct(product);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left text-ink hover:bg-canvas transition-colors duration-micro"
                                    >
                                      <Pencil size={14} />
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActionMenuOpen(null);
                                        // Duplicate: open form with same data but as new product (no ID = create new)
                                        setDuplicateProduct(product);
                                        setFormProduct(null);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left text-ink hover:bg-canvas transition-colors duration-micro"
                                    >
                                      <Copy size={14} />
                                      Duplicate
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActionMenuOpen(null);
                                        setArchiveProduct(product);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left text-ink hover:bg-canvas transition-colors duration-micro"
                                    >
                                      <Archive size={14} />
                                      Archive
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActionMenuOpen(null);
                                        setDeleteError(null);
                                        setDeleteProduct(product);
                                      }}
                                      className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left text-overdue hover:bg-overdue/5 transition-colors duration-micro"
                                    >
                                      <Trash2 size={14} />
                                      Delete
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty space for floating AURA button */}
        <div className="h-16" />
      </div>

      {/* Product Form Side Panel */}
      {formProduct !== undefined && (
        <ProductFormPanel
          onClose={() => {
            setFormProduct(undefined);
            setDuplicateProduct(undefined);
          }}
          onSaved={handleProductSaved}
          product={formProduct ?? undefined}
          duplicateProduct={duplicateProduct}
        />
      )}

      {/* Archive Confirmation Modal */}
      <Modal
        open={archiveProduct !== null}
        onClose={() => {
          if (!deletePending) setArchiveProduct(null);
        }}
        title={`Archive ${archiveProduct?.code} — ${archiveProduct?.name}?`}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setArchiveProduct(null)} disabled={deletePending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void confirmArchive()}
              disabled={deletePending}
            >
              {deletePending ? "Archiving…" : "Archive"}
            </Button>
          </>
        }
      >
        <p>
          This will hide <strong>{archiveProduct?.name}</strong> ({archiveProduct?.code}) from the product picker and list.
          The product will be kept for historical records and its code will remain reserved.
        </p>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteProduct !== null}
        onClose={() => {
          if (!deletePending) setDeleteProduct(null);
        }}
        title={`Delete ${deleteProduct?.code} — ${deleteProduct?.name}?`}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDeleteProduct(null)} disabled={deletePending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDelete()}
              disabled={deletePending}
            >
              {deletePending ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        {deleteError && <p role="alert" className="mb-2 text-overdue">{deleteError}</p>}
        <p>
          This will permanently remove <strong>{deleteProduct?.name}</strong> ({deleteProduct?.code}) from the catalogue.
          Products referenced by historical invoice items or inventory movements cannot be deleted — use Archive instead.
        </p>
      </Modal>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}