import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useWorkspaceStore } from "@/hooks/useWorkspaceStore";
import { AppShell } from "./AppShell";
import { PageHeader } from "./PageHeader";

describe("AppShell theme shortcut", () => {
  beforeEach(() => {
    useWorkspaceStore.persist.clearStorage();
    useWorkspaceStore.setState({ theme: "light" });
    document.documentElement.classList.remove("dark");
  });

  it("toggles the main content theme on T and keeps the shell light", () => {
    render(
      <AppShell>
        <PageHeader title="Working area" />
      </AppShell>,
    );

    fireEvent.keyDown(window, { key: "t" });
    const main = screen.getByRole("main");
    const sidebar = screen.getByRole("complementary");
    const overlayScope = document.querySelector('[data-theme-scope="overlays"]');
    const header = screen.getByText("Working area").closest("div.flex.flex-col");

    expect(useWorkspaceStore.getState().theme).toBe("dark");
    expect(main).toHaveClass("dark");
    expect(overlayScope).toHaveClass("dark");
    expect(header).toBeInTheDocument();
    expect(sidebar).not.toHaveClass("dark");
    expect(document.documentElement).not.toHaveClass("dark");
    const storedTheme = useWorkspaceStore.persist.getOptions().storage?.getItem("sft-billing-theme");
    expect(storedTheme).toMatchObject({ state: { theme: "dark" } });

    fireEvent.keyDown(window, { key: "T" });
    expect(useWorkspaceStore.getState().theme).toBe("light");
    expect(main).not.toHaveClass("dark");
    expect(overlayScope).not.toHaveClass("dark");
  });

  it.each([
    ["input", "input"],
    ["textarea", "textarea"],
    ["contenteditable", "div[contenteditable]"],
  ])("does not toggle while editing in a %s", (kind, selector) => {
    const { container } = render(
      <AppShell>
        {selector === "textarea" ? (
          <textarea aria-label="Editing field" />
        ) : selector === "div[contenteditable]" ? (
          <div aria-label="Text editor" contentEditable />
        ) : (
          <input aria-label="Editing field" />
        )}
      </AppShell>,
    );

    const editor = container.querySelector<HTMLElement>(selector);
    expect(editor).not.toBeNull();
    if (!editor) throw new Error(`Missing ${kind} editor`);
    editor.focus();
    fireEvent.keyDown(editor, { key: "t" });

    expect(useWorkspaceStore.getState().theme).toBe("light");
    expect(screen.getByRole("main")).not.toHaveClass("dark");
  });

  it("does not consume modified shortcuts or repeated key events", () => {
    render(<AppShell><div>Working area</div></AppShell>);

    fireEvent.keyDown(window, { key: "t", ctrlKey: true });
    fireEvent.keyDown(window, { key: "t", repeat: true });

    expect(useWorkspaceStore.getState().theme).toBe("light");
  });
});
