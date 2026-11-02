import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBusinessProfile } from "@/hooks/useBusinessProfile";
import type { BusinessProfile } from "@/types";
import { WorkspaceSettingsPage } from "./WorkspaceSettingsPage";

vi.mock("@/hooks/useBusinessProfile", () => ({
  useBusinessProfile: vi.fn(),
}));

const businessProfile: BusinessProfile = {
  name: "SFT Billing Services",
  logoUrl: "https://example.com/canonical-logo.png",
  address: "14 Cathedral Road",
  email: "hello@example.com",
};

const useBusinessProfileMock = vi.mocked(useBusinessProfile);

describe("WorkspaceSettingsPage", () => {
  beforeEach(() => {
    useBusinessProfileMock.mockReturnValue({
      data: businessProfile,
      loading: false,
      error: undefined,
      reload: vi.fn(),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("previews the canonical business-profile logo and removes unsupported regional controls", () => {
    render(<WorkspaceSettingsPage />);

    expect(screen.getByRole("img", { name: "SFT Billing Services logo preview" })).toHaveAttribute(
      "src",
      businessProfile.logoUrl,
    );
    expect(screen.getByText("Preview from the saved business-profile logo URL.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Upload logo" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Preferences" }));

    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.queryByText("Regional formatting")).not.toBeInTheDocument();
    expect(screen.queryByText("Currency")).not.toBeInTheDocument();
  });
});
