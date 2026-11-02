import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OverviewPage } from "./OverviewPage";
import { activeDataProvider } from "@/services";
import type { BusinessProfile } from "@/types";

vi.mock("@/services", () => ({
  activeDataProvider: {
    getInvoices: vi.fn(() => Promise.resolve([])),
    getClients: vi.fn(() => Promise.resolve([])),
    getPayments: vi.fn(() => Promise.resolve([])),
    getActivity: vi.fn(() => Promise.resolve([])),
    getBusinessProfile: vi.fn(() =>
      Promise.resolve({ name: "SFT Billing", logoUrl: "", address: "", email: "" }),
    ),
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Overview workspace header branding", () => {
  it("shows the supplied full logo instead of business-name initials", async () => {
    vi.spyOn(activeDataProvider, "getInvoices").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getClients").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getPayments").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getActivity").mockResolvedValue([]);
    vi.spyOn(activeDataProvider, "getBusinessProfile").mockResolvedValue({
      name: "Surfine Workspace",
      logoUrl: "",
      address: "",
      email: "",
    } satisfies BusinessProfile);

    render(<OverviewPage />);

    const logo = await screen.findByRole("img", { name: "Surfine Technology logo" });
    expect(logo).toHaveAttribute("src", "/surfine-technology-logo.png");
    expect(logo).toHaveClass("h-10", "w-10", "object-contain");
    expect(screen.getByText("Surfine Workspace")).toBeInTheDocument();
  });
});
