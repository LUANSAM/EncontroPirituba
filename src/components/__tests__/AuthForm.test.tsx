import { render } from "@testing-library/react";
import { AuthForm } from "@/components/organisms/AuthForm";

test("AuthForm snapshot", () => {
  const { container } = render(<AuthForm />);
  expect(container.firstChild).toMatchSnapshot();
});
