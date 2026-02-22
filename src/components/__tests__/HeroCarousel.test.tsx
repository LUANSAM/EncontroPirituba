import { render } from "@testing-library/react";
import { HeroCarousel } from "@/components/organisms/HeroCarousel";

test("HeroCarousel snapshot", () => {
  const { container } = render(<HeroCarousel />);
  expect(container.firstChild).toMatchSnapshot();
});
