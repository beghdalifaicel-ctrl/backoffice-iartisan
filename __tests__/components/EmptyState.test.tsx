import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import EmptyState from "@/components/admin/EmptyState";
import { Users } from "lucide-react";

describe("EmptyState", () => {
  it("renders title and message", () => {
    render(<EmptyState icon={Users} title="Aucun client" message="Les clients apparaîtront ici" />);
    expect(screen.getByText("Aucun client")).toBeInTheDocument();
    expect(screen.getByText("Les clients apparaîtront ici")).toBeInTheDocument();
  });
});
