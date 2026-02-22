import { render } from "@testing-library/react";
import { ProfileHeader } from "@/components/molecules/ProfileHeader";

test("ProfileHeader snapshot", () => {
  const { container } = render(<ProfileHeader type="professional" />);
  expect(container.firstChild).toMatchSnapshot();
});
