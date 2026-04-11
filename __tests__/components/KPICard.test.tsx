import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import KPICard from "@/components/admin/KPICard";

describe("KPICard", () => {
  it("renders compact variant by default", () => {
    render(<KPICard label="Nouveaux" value={12} color="#ff5c00" />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Nouveaux")).toBeInTheDocument();
  });

  it("renders full variant with uppercase label", () => {
    render(<KPICard label="MRR" value="4 900€" color="#ff5c00" variant="full" />);
    expect(screen.getByText("MRR")).toBeInTheDocument();
    expect(screen.getByText("4 900€")).toBeInTheDocument();
  });
});
