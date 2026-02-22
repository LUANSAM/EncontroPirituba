import { render } from "@testing-library/react";
import { BookingModal } from "@/components/organisms/BookingModal";

test("BookingModal snapshot", () => {
  const { container } = render(<BookingModal open onClose={() => undefined} />);
  expect(container.firstChild).toMatchSnapshot();
});
