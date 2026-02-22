import { render } from "@testing-library/react";
import { MapView } from "@/components/organisms/MapView";

test("MapView snapshot", () => {
  const { container } = render(<MapView />);
  expect(container.firstChild).toMatchSnapshot();
});
