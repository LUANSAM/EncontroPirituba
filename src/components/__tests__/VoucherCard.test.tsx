import { render } from "@testing-library/react";
import { VoucherCard } from "@/components/molecules/VoucherCard";

test("VoucherCard snapshot", () => {
  const { container } = render(<VoucherCard />);
  expect(container.firstChild).toMatchSnapshot();
});
