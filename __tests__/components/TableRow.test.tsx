import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import TableRow from "@/components/admin/TableRow";

describe("TableRow", () => {
  it("renders label and value", () => {
    render(<TableRow label="ARPU" value="89€ / client" />);
    expect(screen.getByText("ARPU")).toBeInTheDocument();
    expect(screen.getByText("89€ / client")).toBeInTheDocument();
  });

  it("shows border when not last", () => {
    const { container } = render(<TableRow label="L" value="V" />);
    const row = container.firstChild as HTMLElement;
    expect(row.style.borderBottom).not.toBe("none");
  });

  it("hides border when isLast", () => {
    const { container } = render(<TableRow label="L" value="V" isLast />);
    const row = container.firstChild as HTMLElement;
    // jsdom may use "none" or empty; check the style attribute
    expect(row).toHaveStyle("border-bottom: none");
  });
});
