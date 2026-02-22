import { render } from "@testing-library/react";
import { SearchBar } from "@/components/molecules/SearchBar";

test("SearchBar snapshot", () => {
  const { container } = render(<SearchBar />);
  expect(container.firstChild).toMatchSnapshot();
});
