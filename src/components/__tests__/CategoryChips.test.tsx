import { render } from "@testing-library/react";
import { CategoryChips } from "@/components/molecules/CategoryChips";

test("CategoryChips snapshot", () => {
  const { container } = render(<CategoryChips />);
  expect(container.firstChild).toMatchSnapshot();
});
