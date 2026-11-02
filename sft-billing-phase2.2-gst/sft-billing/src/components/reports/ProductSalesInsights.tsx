import { Package, TrendingUp, TrendingDown, Minus, DollarSign, ShoppingCart, Clock } from "lucide-react";
import { Invoice, Product } from "@/types";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { computeInvoiceTotals } from "@/lib/invoiceMath";
import { cn } from "@/lib/cn";

export interface ProductSalesData {
  productId: string;
  productName: string;
  hsnCode?: string;
  // Current period
  quantitySold: number;
  revenue: number;
  invoiceCount: number;
  // Comparable period
  prevQuantitySold: number;
  prevRevenue: number;
  prevInvoiceCount: number;
  // Trends
  revenueChangePct: number | null;
  quantityChangePct: number | null;
  // Average selling price
  avgPrice: number;
  prevAvgPrice: number;
  // Last sold
  lastSoldDate: string | null;
}

interface ProductSalesInsightsProps {
  invoices: Invoice[];
  products: Product[];
  currentStart: Date;
  currentEnd: Date;
  comparableStart: Date;
  comparableEnd: Date;
}

function computeProductSales(
  invoices: Invoice[],
  products: Product[],
  currentStart: Date,
  currentEnd: Date,
  comparableStart: Date,
  comparableEnd: Date
): ProductSalesData[] {
  const productMap = new Map<string, ProductSalesData>();

  // Initialize all products
  for (const product of products) {
    productMap.set(product.id, {
      productId: product.id,
      productName: product.name,
      hsnCode: product.hsnCode,
      quantitySold: 0,
      revenue: 0,
      invoiceCount: 0,
      prevQuantitySold: 0,
      prevRevenue: 0,
      prevInvoiceCount: 0,
      revenueChangePct: null,
      quantityChangePct: null,
      avgPrice: 0,
      prevAvgPrice: 0,
      lastSoldDate: null,
    });
  }

  // Track invoices that contributed to each product to count unique invoices
  const productInvoiceCounts = new Map<string, Set<string>>();
  const productPrevInvoiceCounts = new Map<string, Set<string>>();

  // Process invoice line items
  for (const invoice of invoices) {
    if (invoice.isDraft) continue;
    const issueDate = new Date(invoice.issueDate);

    const isCurrent = issueDate >= currentStart && issueDate < currentEnd;
    const isComparable = issueDate >= comparableStart && issueDate < comparableEnd;

    if (!isCurrent && !isComparable) continue;

    // Get computed totals to proportionally allocate discount
    const totals = computeInvoiceTotals(invoice);
    const subtotal = invoice.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    for (const item of invoice.items) {
      const productData = productMap.get(item.productId ?? "");
      if (!productData) continue; // Skip items without productId (ad-hoc items)

      const baseValue = item.quantity * item.unitPrice;
      const ratio = subtotal > 0 ? baseValue / subtotal : 0;
      const allocatedDiscount = invoice.discount * ratio;
      const taxableValue = Math.max(0, baseValue - allocatedDiscount);
      const cgstAmount = taxableValue * invoice.gst.cgstRate;
      const sgstAmount = taxableValue * invoice.gst.sgstRate;
      const itemTotal = taxableValue + cgstAmount + sgstAmount;

      // Proportionally allocate round-off
      const roundOffRatio = totals.rawTotal > 0 ? itemTotal / totals.rawTotal : 0;
      const allocatedRoundOff = invoice.roundOff * roundOffRatio;
      const finalItemTotal = itemTotal + allocatedRoundOff;

      if (isCurrent) {
        productData.quantitySold += item.quantity;
        productData.revenue += finalItemTotal;

        if (!productInvoiceCounts.has(item.productId!)) {
          productInvoiceCounts.set(item.productId!, new Set());
        }
        productInvoiceCounts.get(item.productId!)!.add(invoice.id);

        if (!productData.lastSoldDate || issueDate > new Date(productData.lastSoldDate)) {
          productData.lastSoldDate = invoice.issueDate;
        }
      } else if (isComparable) {
        productData.prevQuantitySold += item.quantity;
        productData.prevRevenue += finalItemTotal;

        if (!productPrevInvoiceCounts.has(item.productId!)) {
          productPrevInvoiceCounts.set(item.productId!, new Set());
        }
        productPrevInvoiceCounts.get(item.productId!)!.add(invoice.id);
      }
    }
  }

  // Calculate invoice counts and trends
  for (const data of productMap.values()) {
    data.invoiceCount = productInvoiceCounts.get(data.productId)?.size ?? 0;
    data.prevInvoiceCount = productPrevInvoiceCounts.get(data.productId)?.size ?? 0;

    // Revenue trend
    if (data.prevRevenue > 0) {
      data.revenueChangePct = ((data.revenue - data.prevRevenue) / data.prevRevenue) * 100;
    } else if (data.revenue > 0) {
      data.revenueChangePct = 100;
    }

    // Quantity trend
    if (data.prevQuantitySold > 0) {
      data.quantityChangePct = ((data.quantitySold - data.prevQuantitySold) / data.prevQuantitySold) * 100;
    } else if (data.quantitySold > 0) {
      data.quantityChangePct = 100;
    }

    // Average price
    data.avgPrice = data.quantitySold > 0 ? data.revenue / data.quantitySold : 0;
    data.prevAvgPrice = data.prevQuantitySold > 0 ? data.prevRevenue / data.prevQuantitySold : 0;
  }

  // Convert to array and filter to products with activity
  return Array.from(productMap.values())
    .filter(
      (d) =>
        d.quantitySold > 0 ||
        d.revenue > 0 ||
        d.prevQuantitySold > 0 ||
        d.prevRevenue > 0
    )
    .sort((a, b) => {
      // Sort by revenue descending
      return b.revenue - a.revenue;
    });
}

function getTrendIcon(changePct: number | null) {
  if (changePct === null || changePct === 0) return <Minus className="h-4 w-4 text-ink-muted" aria-hidden />;
  if (changePct > 0) return <TrendingUp className="h-4 w-4 text-success" aria-hidden />;
  return <TrendingDown className="h-4 w-4 text-overdue" aria-hidden />;
}

function getTrendColor(changePct: number | null) {
  if (changePct === null || changePct === 0) return "text-ink-muted";
  if (changePct > 0) return "text-success";
  return "text-overdue";
}

export function ProductSalesInsights({
  invoices,
  products,
  currentStart,
  currentEnd,
  comparableStart,
  comparableEnd,
}: ProductSalesInsightsProps) {
  const sales = computeProductSales(
    invoices,
    products,
    currentStart,
    currentEnd,
    comparableStart,
    comparableEnd
  );

  if (sales.length === 0) {
    return (
      <section className="space-y-4" aria-label="Product Sales Insights">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-ink">Product Sales Insights</p>
          <span className="text-xs text-ink-muted">Period comparison</span>
        </div>
        <div className="flex items-center gap-3 p-4 bg-surface border border-border rounded-lg">
          <Package className="h-5 w-5 text-ink-muted shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-medium text-ink-muted">No product sales in this period</p>
            <p className="text-xs text-ink-faint">Select a wider date range or add products to invoices to see insights.</p>
          </div>
        </div>
      </section>
    );
  }

  const activeProducts = sales.filter((s) => s.quantitySold > 0).length;
  const totalRevenue = sales.reduce((sum, s) => sum + s.revenue, 0);
  const totalQuantity = sales.reduce((sum, s) => sum + s.quantitySold, 0);

  return (
    <section className="space-y-4" aria-label="Product Sales Insights">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">Product Sales Insights</p>
        <span className="text-xs text-ink-muted">Period vs comparable period</span>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
          <Package className="h-5 w-5 text-ink-muted shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-medium text-ink-muted">Active Products</p>
            <p className="font-tabular text-lg font-medium text-ink">{activeProducts}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
          <ShoppingCart className="h-5 w-5 text-ink-muted shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-medium text-ink-muted">Units Sold</p>
            <p className="font-tabular text-lg font-medium text-ink">{totalQuantity}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
          <DollarSign className="h-5 w-5 text-success shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-medium text-ink-muted">Revenue</p>
            <p className="font-tabular text-lg font-medium text-success">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
          <Clock className="h-5 w-5 text-ink-muted shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-medium text-ink-muted">Avg Price/Unit</p>
            <p className="font-tabular text-lg font-medium text-ink">{formatCurrency(totalQuantity > 0 ? totalRevenue / totalQuantity : 0)}</p>
          </div>
        </div>
      </div>

      {/* Product Sales Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full min-w-[840px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface">
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[200px] min-w-[140px]">Product</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[60px] text-right">Units</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[120px] text-right">Revenue</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[80px] text-right">Invoices</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[100px] text-right">Avg Price</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[100px] text-right">Rev Trend</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[100px] text-right">Qty Trend</th>
              <th className="px-4 py-2 text-xs font-medium text-ink-muted w-[100px]">Last Sold</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sales.map((product) => (
              <tr key={product.productId} className="transition-colors duration-micro hover:bg-canvas">
                <td className="px-4 py-2 font-medium text-ink truncate w-[200px] min-w-[140px]">
                  <div>{product.productName}</div>
                  {product.hsnCode && <div className="text-xs text-ink-muted">HSN: {product.hsnCode}</div>}
                </td>
                <td className="px-4 py-2 text-right font-tabular text-ink-muted w-[60px] whitespace-nowrap">
                  {product.quantitySold} {product.quantityChangePct !== null && (
                    <span className={cn("ml-1 text-[10px]", getTrendColor(product.quantityChangePct))}>
                      ({product.quantityChangePct > 0 ? "+" : ""}{product.quantityChangePct.toFixed(0)}%)
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-tabular text-ink w-[120px] whitespace-nowrap">
                  {formatCurrency(product.revenue)} {product.revenueChangePct !== null && (
                    <span className={cn("ml-1 text-[10px]", getTrendColor(product.revenueChangePct))}>
                      ({product.revenueChangePct > 0 ? "+" : ""}{product.revenueChangePct.toFixed(1)}%)
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-right font-tabular text-ink-muted w-[80px] whitespace-nowrap">
                  {product.invoiceCount}
                </td>
                <td className="px-4 py-2 text-right font-tabular text-ink-muted w-[100px] whitespace-nowrap">
                  {formatCurrency(product.avgPrice)}
                </td>
                <td className="px-4 py-2 text-right w-[100px] whitespace-nowrap">
                  <span className={cn("font-tabular text-[11px]", getTrendColor(product.revenueChangePct))}>
                    {product.revenueChangePct !== null
                      ? `${product.revenueChangePct > 0 ? "+" : ""}${product.revenueChangePct.toFixed(1)}%`
                      : "—"}
                  </span>
                  {product.revenueChangePct !== null && getTrendIcon(product.revenueChangePct)}
                </td>
                <td className="px-4 py-2 text-right w-[100px] whitespace-nowrap">
                  <span className={cn("font-tabular text-[11px]", getTrendColor(product.quantityChangePct))}>
                    {product.quantityChangePct !== null
                      ? `${product.quantityChangePct > 0 ? "+" : ""}${product.quantityChangePct.toFixed(1)}%`
                      : "—"}
                  </span>
                  {product.quantityChangePct !== null && getTrendIcon(product.quantityChangePct)}
                </td>
                <td className="px-4 py-2 text-ink-muted w-[100px] whitespace-nowrap">
                  {product.lastSoldDate ? formatDate(product.lastSoldDate) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// The calculation helper is intentionally exported for tests and report reuse.
// eslint-disable-next-line react-refresh/only-export-components
export { computeProductSales };