import { render } from "@testing-library/react";
import { ListingCard } from "@/components/molecules/ListingCard";

test("ListingCard snapshot", () => {
  const { container } = render(<ListingCard title="Teste" subtitle="Sub" />);
  expect(container.firstChild).toMatchSnapshot();
});
