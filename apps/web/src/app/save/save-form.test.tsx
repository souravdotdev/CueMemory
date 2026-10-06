import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

const createItem = vi.fn();
vi.mock("@/lib/api", () => ({ createItem: (url: string) => createItem(url) }));

const { SaveForm } = await import("./save-form");

describe("SaveForm", () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
    createItem.mockReset();
  });

  it("saves the pasted URL and navigates back to the feed", async () => {
    createItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(<SaveForm />);

    await user.type(screen.getByPlaceholderText("Paste a link…"), "https://example.com/article");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createItem).toHaveBeenCalledWith("https://example.com/article");
    expect(push).toHaveBeenCalledWith("/");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows an error message and does not navigate when saving fails", async () => {
    createItem.mockRejectedValue(new Error("Failed to save item"));
    const user = userEvent.setup();
    render(<SaveForm />);

    await user.type(screen.getByPlaceholderText("Paste a link…"), "https://example.com/article");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Failed to save item")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("trims spaces from the pasted link before saving", async () => {
    createItem.mockResolvedValue({});
    const user = userEvent.setup();
    render(<SaveForm />);

    await user.type(
      screen.getByPlaceholderText("Paste a link…"),
      "  https://example.com/article  ",
    );
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(createItem).toHaveBeenCalledWith("https://example.com/article");
  });

  it.each(["ftp://example.com/file", "not a link"])(
    "rejects %j with the shared contract's message and does not save",
    async (link) => {
      const user = userEvent.setup();
      render(<SaveForm />);

      await user.type(screen.getByPlaceholderText("Paste a link…"), link);
      await user.click(screen.getByRole("button", { name: "Save" }));

      expect(await screen.findByText("Enter a valid http(s) link")).toBeTruthy();
      expect(createItem).not.toHaveBeenCalled();
    },
  );

  it("rejects a link over 2048 characters and does not save", async () => {
    const user = userEvent.setup();
    render(<SaveForm />);
    const input = screen.getByPlaceholderText("Paste a link…");

    // Pasting is far faster than typing thousands of characters.
    await user.click(input);
    await user.paste("https://example.com/" + "a".repeat(2048));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("Links can be at most 2048 characters")).toBeTruthy();
    expect(createItem).not.toHaveBeenCalled();
  });
});
