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
  X,
  Copy,
  Tag,
  Archive,
} from "lucide-react";
import { Segmented, SearchField, SpotlightCard, Stat, StatGroup } from "@/components/ui/kit";
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
  const baseProductLabel = showTestItems ? "product" : "active product";

  if (error) {
    return (
      <div>
        <PageHeader title="Products" subtitle="Manage your product catalogue" />
        <div className="px-6 lg:px-8 py-10">
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
    <div>
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
      <div className="mb-6 px-6 lg:px-8" role="region" aria-label="Product summary">
        <StatGroup className="md:[--cols:3]">
          <Stat
            label="Total products"
            tone="accent"
            value={summary.totalProducts}
            format={(n) => String(Math.round(n))}
            sub={`${activeProductsCount} active · ${summary.testItemsHidden} test items hidden`}
          />
          <div className="min-w-0 px-5 py-4">
            <span className="flex items-center gap-2 text-xs font-medium text-ink-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              Top billed product
            </span>
            {summary.topBilledProduct ? (
              <>
                <p className="mt-2 truncate text-[1.65rem] font-medium leading-none tracking-tight text-ink" title={summary.topBilledProduct.name}>
                  {summary.topBilledProduct.code}
                </p>
                <p className="mt-2 truncate text-xs text-ink-faint">
                  {summary.topBilledProduct.name} · used in {summary.topBilledProduct.count} invoice{summary.topBilledProduct.count !== 1 ? "s" : ""}
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-[1.65rem] font-medium leading-none tracking-tight text-ink-faint">—</p>
                <p className="mt-2 text-xs text-ink-faint">No invoice data</p>
              </>
            )}
          </div>
          <Stat
            label="Needs attention"
            tone={summary.needsAttentionCount > 0 ? "overdue" : "success"}
            value={summary.needsAttentionCount}
            format={(n) => String(Math.round(n))}
            delay={0.12}
            sub={summary.needsAttentionCount > 0 ? "Missing HSN, price or code" : "All good"}
          />
        </StatGroup>
      </div>

      <div className="px-6 pb-12 lg:px-8">
        {/* Search & Filters Bar */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <SearchField value={query} onChange={setQuery} placeholder="Search by code, name, or HSN…" label="Search products" className="w-full sm:w-80" />

          <div role="group" aria-label="Filter by GST slab" className="flex items-center gap-2">
            <span className="hidden text-xs text-ink-muted sm:inline">GST</span>
            <Segmented
              value={gstFilter ?? "all"}
              onChange={(value) => setGstFilter(value === "all" ? null : value)}
              options={[
                { value: "all", label: "All", count: visibleProducts },
                ...gstOptions.map((rate) => {
                  const baseProducts = showTestItems ? products ?? [] : (products ?? []).filter((p) => !isTestProduct(p));
                  return {
                    value: String(rate),
                    label: formatRate(rate / 100),
                    count: baseProducts.filter((p) => Math.round(p.defaultGstRate * 100) === rate).length,
                  };
                }),
              ]}
            />
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSortBy(sortBy === "code" ? "name" : sortBy === "name" ? "price" : sortBy === "price" ? "recent" : "code")}
              className="flex h-10 items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-accent"
              aria-haspopup="listbox"
              aria-expanded={false}
              aria-label="Sort products"
            >
              <ArrowUpDown size={14} className="text-ink-muted" aria-hidden />
              <span className="truncate">{sortBy === "code" ? "Sort: Code" : sortBy === "name" ? "Sort: Name" : sortBy === "price" ? "Sort: Price" : "Sort: Recent"}</span>
              <ChevronDown size={14} className="text-ink-muted" aria-hidden />
            </button>

            <button
              type="button"
              onClick={() => setGroupBy(groupBy === "none" ? "alpha" : "none")}
              className={cn(
                "flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors",
                groupBy !== "none" ? "border-accent bg-accent/5 text-accent" : "border-border-strong bg-surface text-ink hover:border-accent",
              )}
              aria-label="Group by"
            >
              <Tag size={14} className={groupBy !== "none" ? "text-accent" : "text-ink-muted"} aria-hidden />
              <span className="truncate">{groupBy === "none" ? "No grouping" : "Group: A-Z"}</span>
            </button>

            {testItemsCount > 0 && (
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-border-strong bg-surface px-4 text-sm text-ink-muted transition-colors hover:border-accent">
                <input type="checkbox" checked={showTestItems} onChange={(e) => setShowTestItems(e.target.checked)} className="accent-accent" />
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
          <div className="space-y-8">
            {groupedProducts.map(({ group, products: groupProducts }) => (
              <section key={group} aria-label={group}>
                {groupBy !== "none" && <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">{group}</h3>}
                <ul className="stagger-grid grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {groupProducts.map((product) => {
                    const isTest = isTestProduct(product);
                    const usageCount = invoiceUsageCount.get(product.id) ?? 0;
                    const gstPct = Math.round(product.defaultGstRate * 100);
                    return (
                      <li key={product.id}>
                        <SpotlightCard className={cn("rounded-xl border border-border bg-surface transition-colors hover:border-border-strong", isTest && "bg-overdue/5")}>
                          <div ref={actionMenuOpen === product.id ? actionMenuRef : undefined} className="p-5">
                            <div className="flex items-start justify-between gap-3">
                              <span className="max-w-[70%] truncate rounded-full bg-accent/10 px-2.5 py-1 font-mono text-[11px] font-medium text-accent" title={product.code}>
                                {product.code}
                              </span>

                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActionMenuOpen(actionMenuOpen === product.id ? null : product.id);
                                  }}
                                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-canvas hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                                  aria-label={`More actions for ${product.name}`}
                                  aria-expanded={actionMenuOpen === product.id}
                                  aria-haspopup="true"
                                >
                                  <MoreHorizontal size={15} />
                                </button>

                                {actionMenuOpen === product.id && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setActionMenuOpen(null)} aria-hidden="true" />
                                    <div className="absolute right-0 top-full z-20 mt-1.5 min-w-[150px] overflow-hidden rounded-xl border border-border bg-surface-raised p-1 shadow-float-lg">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActionMenuOpen(null);
                                          setFormProduct(product);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-canvas"
                                      >
                                        <Pencil size={14} />
                                        Edit
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActionMenuOpen(null);
                                          setDuplicateProduct(product);
                                          setFormProduct(null);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-canvas"
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
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-canvas"
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
                                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-overdue transition-colors hover:bg-overdue-bg"
                                      >
                                        <Trash2 size={14} />
                                        Delete
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>

                            <h4 className="mt-3 truncate text-[15px] font-semibold text-ink" title={product.name}>
                              {product.name}
                            </h4>
                            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                              <span className="font-mono">HSN {product.hsnCode}</span>
                              <span aria-hidden="true">·</span>
                              <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] font-medium ring-1 ring-border">{gstPct}% GST</span>
                            </p>

                            <div className="mt-5 flex items-end justify-between gap-2">
                              <div>
                                <p className="text-[11px] text-ink-faint">Unit price</p>
                                <p className="font-tabular text-xl font-semibold tracking-tight text-ink">{formatCurrency(product.defaultUnitPrice, true)}</p>
                              </div>
                              <p className={cn("text-xs", usageCount > 0 ? "font-tabular text-ink-muted" : "text-ink-faint")}>
                                {usageCount > 0 ? `${usageCount} invoice${usageCount !== 1 ? "s" : ""}` : "Unused"}
                              </p>
                            </div>

                            <Button
                              size="sm"
                              variant="secondary"
                              className="mt-4 w-full"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActionMenuOpen(null);
                                setFormProduct(product);
                              }}
                              aria-label={`Edit ${product.name}`}
                            >
                              <Pencil size={12} /> Edit
                            </Button>
                          </div>
                        </SpotlightCard>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
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