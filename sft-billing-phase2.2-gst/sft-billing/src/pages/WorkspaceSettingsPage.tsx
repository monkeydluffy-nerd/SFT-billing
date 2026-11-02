import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Landmark,
  Palette,
  Percent,
  Receipt,
  Save,
  Settings2,
  ShieldAlert,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { OverviewSkeleton } from "@/components/shared/SkeletonLoader";
import { Button } from "@/components/shared/Button";
import { Toast } from "@/components/shared/Toast";
import { SettingsTabs, type SettingsTabDefinition, type SettingsTabId } from "@/components/settings/SettingsTabs";
import { SettingsSection } from "@/components/settings/SettingsSection";
import { SettingsField, FixedValue, settingsInputClass, settingsTextareaClass } from "@/components/settings/SettingsField";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { activeDataProvider } from "@/services";
import type { BusinessProfile } from "@/types";

type FormState = {
  name: string;
  logoUrl: string;
  address: string;
  email: string;
  phone: string;
  gstin: string;
  pan: string;
  declaration: string;
  authorizedSignatory: string;
  cgstRate: string;
  sgstRate: string;
  bankAccountHolder: string;
  bankName: string;
  bankBranch: string;
  bankAccountNumber: string;
  bankIfsc: string;
};

const TABS: SettingsTabDefinition[] = [
  { id: "general", label: "General", icon: Building2 },
  { id: "billing", label: "Billing", icon: Receipt },
  { id: "preferences", label: "Preferences", icon: Palette },
  { id: "advanced", label: "Advanced", icon: Settings2 },
];

function profileToForm(profile: BusinessProfile): FormState {
  return {
    name: profile.name,
    logoUrl: profile.logoUrl ?? "",
    address: profile.address,
    email: profile.email,
    phone: profile.phone ?? "",
    gstin: profile.gstin ?? "",
    pan: profile.pan ?? "",
    declaration: profile.declaration ?? "",
    authorizedSignatory: profile.authorizedSignatory ?? "",
    cgstRate: profile.defaultGst ? String(profile.defaultGst.cgstRate * 100) : "9",
    sgstRate: profile.defaultGst ? String(profile.defaultGst.sgstRate * 100) : "9",
    bankAccountHolder: profile.bank?.accountHolder ?? "",
    bankName: profile.bank?.bankName ?? "",
    bankBranch: profile.bank?.branch ?? "",
    bankAccountNumber: profile.bank?.accountNumber ?? "",
    bankIfsc: profile.bank?.ifsc ?? "",
  };
}

const inputTabular = `font-tabular ${settingsInputClass}`;

export function WorkspaceSettingsPage() {
  const { data: profile, loading, error, reload } = useBusinessProfile();
  const { theme, toggleTheme } = useWorkspaceStore();

  const [activeTab, setActiveTab] = useState<SettingsTabId>("general");
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (profile && !form) setForm(profileToForm(profile));
  }, [profile, form]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function handleSave() {
    if (!form) return;
    setSaving(true);
    const cgstRate = Math.max(0, Math.min(100, Number(form.cgstRate) || 0)) / 100;
    const sgstRate = Math.max(0, Math.min(100, Number(form.sgstRate) || 0)) / 100;

    await activeDataProvider.updateBusinessProfile({
      name: form.name.trim(),
      logoUrl: form.logoUrl.trim() || undefined,
      address: form.address.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || undefined,
      gstin: form.gstin.trim() || undefined,
      pan: form.pan.trim() || undefined,
      declaration: form.declaration.trim() || undefined,
      authorizedSignatory: form.authorizedSignatory.trim() || undefined,
      defaultGst: { cgstRate, sgstRate },
      bank: form.bankAccountHolder.trim()
        ? {
            accountHolder: form.bankAccountHolder.trim(),
            bankName: form.bankName.trim(),
            branch: form.bankBranch.trim(),
            accountNumber: form.bankAccountNumber.trim(),
            ifsc: form.bankIfsc.trim(),
          }
        : undefined,
    });

    setSaving(false);
    reload();
    setToast("Workspace settings saved");
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Workspace Settings" subtitle="Your business identity and billing defaults" />
        <div className="px-10 py-10">
          <EmptyState icon={AlertTriangle} title="Couldn't load settings" description={error.message} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Workspace Settings"
        subtitle="Your business identity and billing defaults"
        action={
          <Button onClick={handleSave} disabled={saving || !form}>
            <Save size={14} /> {saving ? "Saving..." : "Save changes"}
          </Button>
        }
      />

      <div className="px-10 py-8 pb-16">
        {loading || !form || !profile ? (
          <OverviewSkeleton />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[180px_1fr]">
            <SettingsTabs tabs={TABS} active={activeTab} onSelect={setActiveTab} />

            <div className="space-y-6">
              {activeTab === "general" && (
                <SettingsSection
                  icon={Building2}
                  title="Business profile"
                  description="Shown as the 'from' party on every invoice preview and export"
                >
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <SettingsField label="Business name" fullWidth>
                      <input value={form.name} onChange={(e) => update("name", e.target.value)} className={settingsInputClass} />
                    </SettingsField>
                    <SettingsField label="Address" fullWidth>
                      <textarea
                        value={form.address}
                        onChange={(e) => update("address", e.target.value)}
                        rows={2}
                        className={settingsTextareaClass}
                      />
                    </SettingsField>
                    <SettingsField label="Email">
                      <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} className={settingsInputClass} />
                    </SettingsField>
                    <SettingsField label="Phone">
                      <input value={form.phone} onChange={(e) => update("phone", e.target.value)} className={settingsInputClass} />
                    </SettingsField>
                    <SettingsField label="GSTIN">
                      <input value={form.gstin} onChange={(e) => update("gstin", e.target.value.toUpperCase())} className={inputTabular} />
                    </SettingsField>
                    <SettingsField label="PAN">
                      <input value={form.pan} onChange={(e) => update("pan", e.target.value.toUpperCase())} className={inputTabular} />
                    </SettingsField>
                    <SettingsField
                      label="Logo"
                      hint="Enter the image URL used by invoice documents."
                      fullWidth
                    >
                      <div className="space-y-3">
                        <input
                          type="url"
                          value={form.logoUrl}
                          onChange={(e) => update("logoUrl", e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className={settingsInputClass}
                        />
                        {form.logoUrl ? (
                          <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
                            <img
                              src={form.logoUrl}
                              alt={`${form.name || "Business"} logo preview`}
                              className="h-12 w-12 shrink-0 rounded-md object-cover"
                            />
                            <p className="text-xs text-ink-muted">Preview from the saved business-profile logo URL.</p>
                          </div>
                        ) : (
                          <p className="text-sm text-ink-faint">No business logo configured</p>
                        )}
                      </div>
                    </SettingsField>
                  </div>
                </SettingsSection>
              )}

              {activeTab === "billing" && (
                <>
                  <SettingsSection icon={Receipt} title="Invoice defaults" description="Applied when a new invoice draft is created">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <FixedValue label="Invoice numbering" value="NNN/YYYY-YY (auto-generated)" hint="Generated automatically, never reused." />
                      <FixedValue label="Default payment terms" value="Net 15" />
                      <SettingsField label="Default declaration / terms" fullWidth>
                        <textarea
                          value={form.declaration}
                          onChange={(e) => update("declaration", e.target.value)}
                          rows={3}
                          placeholder="We declare that this invoice shows the actual price of the goods/services described..."
                          className={settingsTextareaClass}
                        />
                      </SettingsField>
                      <SettingsField label="Authorized signatory">
                        <input
                          value={form.authorizedSignatory}
                          onChange={(e) => update("authorizedSignatory", e.target.value)}
                          className={settingsInputClass}
                        />
                      </SettingsField>
                      <FixedValue
                        label="Round-off"
                        value="Suggested, never automatic"
                        hint="Always a one-click suggestion on the invoice itself - a deliberate product decision, not a missing feature."
                      />
                    </div>
                  </SettingsSection>

                  <SettingsSection icon={Percent} title="Tax & GST" description="Default CGST/SGST rates applied to new invoice drafts">
                    <div className="grid grid-cols-2 gap-4">
                      <SettingsField label="CGST rate (%)">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={form.cgstRate}
                          onChange={(e) => update("cgstRate", e.target.value)}
                          className={inputTabular}
                        />
                      </SettingsField>
                      <SettingsField label="SGST rate (%)">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={form.sgstRate}
                          onChange={(e) => update("sgstRate", e.target.value)}
                          className={inputTabular}
                        />
                      </SettingsField>
                    </div>
                    <p className="mt-4 text-xs text-ink-faint">
                      Editable per invoice at creation time. HSN/SAC codes are set per line item, not here.
                    </p>
                  </SettingsSection>

                  <SettingsSection icon={Landmark} title="Bank details" description="Printed on the invoice's payment details block">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <SettingsField label="Account holder" fullWidth>
                        <input
                          value={form.bankAccountHolder}
                          onChange={(e) => update("bankAccountHolder", e.target.value)}
                          className={settingsInputClass}
                        />
                      </SettingsField>
                      <SettingsField label="Bank">
                        <input value={form.bankName} onChange={(e) => update("bankName", e.target.value)} className={settingsInputClass} />
                      </SettingsField>
                      <SettingsField label="Branch">
                        <input value={form.bankBranch} onChange={(e) => update("bankBranch", e.target.value)} className={settingsInputClass} />
                      </SettingsField>
                      <SettingsField label="Account number">
                        <input
                          value={form.bankAccountNumber}
                          onChange={(e) => update("bankAccountNumber", e.target.value)}
                          className={inputTabular}
                        />
                      </SettingsField>
                      <SettingsField label="IFSC">
                        <input value={form.bankIfsc} onChange={(e) => update("bankIfsc", e.target.value.toUpperCase())} className={inputTabular} />
                      </SettingsField>
                    </div>
                  </SettingsSection>
                </>
              )}

              {activeTab === "preferences" && (
                <>
                  <SettingsSection icon={Palette} title="Appearance" description="Personal display preference for this workspace">
                    <SettingsField label="Theme">
                      <button
                        type="button"
                        onClick={toggleTheme}
                        className={`${settingsInputClass} flex max-w-xs items-center justify-between px-2.5`}
                      >
                        <span className="capitalize">{theme}</span>
                        <span className="text-xs text-accent">Switch</span>
                      </button>
                    </SettingsField>
                  </SettingsSection>
                </>
              )}

              {activeTab === "advanced" && (
                <SettingsSection icon={ShieldAlert} title="Data & workspace actions" description="Destructive actions - handle with care">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-4 rounded-md border border-overdue/20 bg-overdue-bg/40 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-ink">Reset demo data</p>
                        <p className="mt-0.5 text-xs text-ink-muted">Restores the original demo clients, invoices, and payments.</p>
                      </div>
                      <button
                        type="button"
                        disabled
                        title="Requires a safe reset mechanism in the data layer, not available yet"
                        className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink-faint opacity-50 cursor-not-allowed"
                      >
                        Reset
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-md border border-overdue/20 bg-overdue-bg/40 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-ink">Clear workspace data</p>
                        <p className="mt-0.5 text-xs text-ink-muted">Permanently removes all clients, invoices, and payments.</p>
                      </div>
                      <button
                        type="button"
                        disabled
                        title="Requires a safe, confirmable delete mechanism, not available yet"
                        className="shrink-0 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-ink-faint opacity-50 cursor-not-allowed"
                      >
                        Clear data
                      </button>
                    </div>
                  </div>
                </SettingsSection>
              )}
            </div>
          </div>
        )}
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}