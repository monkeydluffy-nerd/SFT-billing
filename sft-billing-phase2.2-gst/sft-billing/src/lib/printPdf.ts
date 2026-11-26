/** Prints a PDF blob through a hidden iframe so only the document is printed, not the app screen. */
export function printPdfBlob(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";

    const cleanup = () => {
      window.setTimeout(() => {
        frame.remove();
        URL.revokeObjectURL(url);
      }, 60_000);
    };

    frame.onload = () => {
      try {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
        cleanup();
        resolve();
      } catch (error) {
        cleanup();
        reject(error instanceof Error ? error : new Error("Couldn't open the print dialog."));
      }
    };
    frame.src = url;
    document.body.appendChild(frame);
  });
}
