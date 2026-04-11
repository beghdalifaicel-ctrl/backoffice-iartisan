import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import FilterButton from "@/components/admin/FilterButton";

describe("FilterButton", () => {
  it("renders the label", () => {
    render(<FilterButton label="Tous" active={false} onClick={() => {}} />);
    expect(screen.getByText("Tous")).toBeInTheDocument();
  });

  it("applies active styles when active", () => {
    render(<FilterButton label="Actifs" active={true} onClick={() => {}} />);
    const btn = screen.getByText("Actifs");
    expect(btn).toHaveStyle({ color: "#ff5c00" });
  });

  it("applies inactive styles when not active", () => {
    render(<FilterButton label="Essai" active={false} onClick={() => {}} />);
    const btn = screen.getByText("Essai");
    expect(btn).toHaveStyle({ color: "#7a7a6a" });
  });

  it("calls onClick when clicked", () => {
    const onClick = jest.fn();
    render(<FilterButton label="Click me" active={false} onClick={onClick} />);
    fireEvent.click(screen.getByText("Click me"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("supports custom activeColor and activeBg", () => {
    render(<FilterButton label="Pro" active={true} activeColor="#2d6a4f" activeBg="rgba(45,106,79,.1)" onClick={() => {}} />);
    const btn = screen.getByText("Pro");
    expect(btn).toHaveStyle({ color: "#2d6a4f", background: "rgba(45,106,79,.1)" });
  });
});
