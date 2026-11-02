import { describe, expect, it } from "vitest";
import { amountInWords } from "./amountInWords";

describe("amountInWords", () => {
  it("renders the worked example grand total (₹30,326) in words", () => {
    expect(amountInWords(30326)).toBe("Thirty Thousand Three Hundred Twenty Six Rupees Only");
  });

  it("renders zero", () => {
    expect(amountInWords(0)).toBe("Zero Rupees Only");
  });

  it("renders an exact lakh boundary", () => {
    expect(amountInWords(100000)).toBe("One Lakh Rupees Only");
  });

  it("renders an exact crore boundary", () => {
    expect(amountInWords(10000000)).toBe("One Crore Rupees Only");
  });

  it("includes a paise clause when the amount has a fractional part", () => {
    expect(amountInWords(30326.5)).toBe("Thirty Thousand Three Hundred Twenty Six Rupees and Fifty Paise Only");
  });

  it("renders the audited ₹7,328 total without a spurious 100 paise", () => {
    expect(amountInWords(7328)).toBe("Seven Thousand Three Hundred Twenty Eight Rupees Only");
  });

  it("preserves paise for the audited total with fifty paise", () => {
    expect(amountInWords(7328.5)).toBe(
      "Seven Thousand Three Hundred Twenty Eight Rupees and Fifty Paise Only",
    );
  });

  it("carries rounded paise into the next rupee", () => {
    expect(amountInWords(7327.999999999)).toBe("Seven Thousand Three Hundred Twenty Eight Rupees Only");
  });
});
