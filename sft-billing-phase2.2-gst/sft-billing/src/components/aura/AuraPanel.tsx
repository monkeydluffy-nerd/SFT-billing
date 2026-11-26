import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X, ArrowUp } from "lucide-react";
import { useWorkspaceStore, type AppPage } from "@/hooks/useWorkspaceStore";
import { useInvoices } from "@/hooks/useInvoices";
import { useClients } from "@/hooks/useClients";
import { usePayments } from "@/hooks/usePayments";
import { computeStatusTotals } from "@/lib/overviewMetrics";
import { runAuraCommand } from "@/lib/auraAssistant";
import { cn } from "@/lib/cn";

interface Message {
  id: string;
  from: "user" | "aura";
  text: string;
}

const SUGGESTIONS = [
  "What is the total billed amount?",
  "How much is outstanding?",
  "Show overdue invoices",
];

/**
 * Pages with fixed/sticky controls or protected invoice content need AURA
 * to sit higher so it never overlaps those regions. Ordinary pages retain
 * the established bottom-right position.
 */
const PAGES_WITH_PROTECTED_CONTENT: ReadonlySet<AppPage> = new Set(["create-invoice", "invoice-detail"]);

export function AuraPanel() {
  const { auraOpen, openAura, closeAura, goToInvoices, openCreateInvoice, currentPage } = useWorkspaceStore();
  const { data: invoices } = useInvoices();
  const { data: clients } = useClients();
  const { data: payments } = usePayments();

  const hasProtectedContent = PAGES_WITH_PROTECTED_CONTENT.has(currentPage);
  const bottomOffsetClass = hasProtectedContent ? "bottom-24" : "bottom-6";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      from: "aura",
      text: "I'm AURA. Ask about totals, outstanding or overdue amounts, collections, or invoice/client counts - or ask me to create an invoice.",
    },
  ]);
  const [input, setInput] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const threadEndRef = useRef<HTMLDivElement>(null);
  const messageCounter = useRef(0);

  const totals = useMemo(() => (invoices ? computeStatusTotals(invoices) : undefined), [invoices]);
  const hasInsight = (totals?.overdue.count ?? 0) > 0;

  useEffect(() => {
    const interval = setInterval(() => setPlaceholderIndex((i) => (i + 1) % SUGGESTIONS.length), 3200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !invoices || !clients || !payments) return;

    messageCounter.current += 1;
    const userMessage: Message = { id: `m-${messageCounter.current}`, from: "user", text: trimmed };

    const reply = runAuraCommand(trimmed, { invoices, clients, payments, goToInvoices, openCreateInvoice });
    messageCounter.current += 1;
    const auraMessage: Message = { id: `m-${messageCounter.current}`, from: "aura", text: reply.text };

    setMessages((prev) => [...prev, userMessage, auraMessage]);
    setInput("");
  }

  return (
    <>
      {/* Collapsed mark */}
      <AnimatePresence>
        {!auraOpen && (
          <motion.button
            type="button"
            onClick={openAura}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className={cn(
              "print:hidden fixed right-4 z-40 flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-premium shadow-float transition-colors duration-micro hover:border-premium/40",
              bottomOffsetClass,
            )}
            aria-label="Open AURA, the financial workspace assistant"
          >
            <span className="relative flex h-2 w-2">
              {hasInsight && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-premium opacity-60" />
              )}
              <span className={cn("relative inline-flex h-2 w-2 rounded-full", hasInsight ? "bg-premium" : "bg-border-strong")} />
            </span>
            <Sparkles size={12} aria-hidden />
            AURA
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded panel - coexists with the page, never a full takeover */}
      <AnimatePresence>
        {auraOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "print:hidden fixed right-4 z-40 flex h-[440px] w-[330px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-surface-raised shadow-float-lg",
              bottomOffsetClass,
            )}
            role="dialog"
            aria-label="AURA financial workspace assistant"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-premium" aria-hidden />
                <p className="font-display text-sm text-ink">AURA</p>
              </div>
              <button
                type="button"
                onClick={closeAura}
                className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors duration-micro hover:bg-canvas hover:text-ink"
                aria-label="Close AURA"
              >
                <X size={15} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                    message.from === "user" ? "ml-auto bg-accent text-accent-ink" : "bg-canvas text-ink",
                  )}
                >
                  {message.text}
                </div>
              ))}
              <div ref={threadEndRef} />
            </div>

            <div className="border-t border-border p-3">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-ink-muted transition-colors duration-micro hover:border-border-strong hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Try: "${SUGGESTIONS[placeholderIndex]}"`}
                  className="h-10 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
                  aria-label="Ask AURA"
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-accent-ink transition-opacity duration-micro disabled:opacity-30"
                  aria-label="Send"
                >
                  <ArrowUp size={14} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}