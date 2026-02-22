import { render } from "@testing-library/react";
import { AdminReviewTable } from "@/components/organisms/AdminReviewTable";

test("AdminReviewTable snapshot", () => {
  const { container } = render(<AdminReviewTable />);
  expect(container.firstChild).toMatchSnapshot();
});
