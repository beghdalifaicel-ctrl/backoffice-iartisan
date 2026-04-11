import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import Pagination from "@/components/admin/Pagination";

describe("Pagination", () => {
  it("renders nothing when pages <= 1", () => {
    const { container } = render(<Pagination page={1} pages={1} onPageChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows page indicator", () => {
    render(<Pagination page={2} pages={5} onPageChange={() => {}} />);
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });

  it("calls onPageChange with previous page", () => {
    const onPageChange = jest.fn();
    render(<Pagination page={3} pages={5} onPageChange={onPageChange} />);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[0]); // prev
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange with next page", () => {
    const onPageChange = jest.fn();
    render(<Pagination page={3} pages={5} onPageChange={onPageChange} />);
    const buttons = screen.getAllByRole("button");
    fireEvent.click(buttons[1]); // next
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it("disables prev button on first page", () => {
    render(<Pagination page={1} pages={3} onPageChange={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toBeDisabled();
  });

  it("disables next button on last page", () => {
    render(<Pagination page={3} pages={3} onPageChange={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons[1]).toBeDisabled();
  });
});
