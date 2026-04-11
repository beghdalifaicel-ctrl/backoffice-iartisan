import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import Badge from "@/components/admin/Badge";

describe("Badge", () => {
  it("renders the label text", () => {
    render(<Badge label="Actif" bg="rgba(45,106,79,.1)" color="#2d6a4f" />);
    expect(screen.getByText("Actif")).toBeInTheDocument();
  });

  it("applies the correct background and color", () => {
    render(<Badge label="Impayé" bg="rgba(239,68,68,.1)" color="#ef4444" />);
    const badge = screen.getByText("Impayé");
    expect(badge).toHaveStyle({ background: "rgba(239,68,68,.1)", color: "#ef4444" });
  });

  it("merges custom styles", () => {
    render(<Badge label="Test" bg="#fff" color="#000" style={{ marginLeft: 8 }} />);
    const badge = screen.getByText("Test");
    expect(badge).toHaveStyle({ marginLeft: "8px" });
  });
});
