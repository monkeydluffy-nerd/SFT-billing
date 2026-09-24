const PAGE_W = 793.7;
const PAGE_H = 1122.5;
const SAFETY = 0.99;

function applyPrintFit() {
  document.querySelectorAll<HTMLElement>(".inv").forEach((el) => {
    const oldHeight = el.style.height;
    const oldMinHeight = el.style.minHeight;
    const oldZoom = el.style.zoom;

    // Measure the REAL content height, not the fixed 1448px box.
    el.style.setProperty("height", "auto", "important");
    el.style.setProperty("min-height", "0", "important");
    el.style.setProperty("zoom", "1", "important");

    const height = el.getBoundingClientRect().height;
    const width = el.getBoundingClientRect().width;

    const zoom = Math.min(PAGE_W / width, PAGE_H / height) * SAFETY;

    el.style.setProperty("--inv-print-zoom", zoom.toFixed(5));

    // Restore normal layout; print CSS uses the calculated zoom.
    el.style.height = oldHeight;
    el.style.minHeight = oldMinHeight;
    el.style.zoom = oldZoom;
  });
}

function clearPrintFit() {
  document.querySelectorAll<HTMLElement>(".inv").forEach((el) => {
    el.style.removeProperty("--inv-print-zoom");
  });
}

let installed = false;

export function installInvoicePrintFit() {
  if (installed || typeof window === "undefined") return;

  installed = true;

  window.addEventListener("beforeprint", applyPrintFit);
  window.addEventListener("afterprint", clearPrintFit);

  window.matchMedia?.("print").addEventListener?.("change", (event) => {
    if (event.matches) applyPrintFit();
    else clearPrintFit();
  });
}

installInvoicePrintFit();