import React, { FC, ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SubmitHandler,
  UnpackNestedValue,
  UseFormProps,
} from "react-hook-form";

import { useFormBuilder, UseFormBuilderReturn } from "./formbuilder";

describe("useFormBuilder", () => {
  interface FormData {
    firstName: string;
    lastName: string;
  }

  const createHarness = (
    props?: UseFormProps<FormData>,
    renderChild?: (builder: UseFormBuilderReturn<FormData>) => ReactNode
  ) => {
    const returnValue: {
      Form: typeof Form;
      formBuilder: UseFormBuilderReturn<FormData>;
      values: UnpackNestedValue<FormData>;
    } = {} as any;

    const Form: FC<{
      onSubmit?: SubmitHandler<FormData>;
    }> = ({ onSubmit }) => {
      returnValue.formBuilder = useFormBuilder<FormData>(props);
      const { fields, handleSubmit, watch } = returnValue.formBuilder;
      returnValue.values = watch();
      return (
        <form onSubmit={onSubmit != null ? handleSubmit(onSubmit) : undefined}>
          <input {...fields.firstName()} aria-label="first-name-input" />
          <input {...fields.lastName()} aria-label="last-name-input" />
          <button type="submit">Submit</button>
          {renderChild != null ? renderChild(returnValue.formBuilder) : null}
        </form>
      );
    };

    returnValue.Form = Form;

    return returnValue;
  };

  const defaultValues: FormData = {
    firstName: "John",
    lastName: "Smith",
  };

  beforeAll(() => {
    userEvent.setup();
  });

  test("Two-way binding", async () => {
    let formData = { ...defaultValues };

    const handleSubmit: SubmitHandler<FormData> = (data) => {
      formData = data;
    };

    const harness = createHarness({ defaultValues });

    render(<harness.Form onSubmit={handleSubmit}></harness.Form>);

    const firstNameInput = screen.getByLabelText("first-name-input");
    const lastNameInput = screen.getByLabelText("last-name-input");

    // Default values are pre-filled
    expect(firstNameInput).toHaveValue("John");
    expect(lastNameInput).toHaveValue("Smith");

    await act(async () => {
      await userEvent.clear(firstNameInput);
      await userEvent.type(firstNameInput, "Joe");
      await userEvent.clear(lastNameInput);
      await userEvent.type(lastNameInput, "Bloggs");
    });

    // Inputs contain new values
    expect(firstNameInput).toHaveValue("Joe");
    expect(lastNameInput).toHaveValue("Bloggs");

    await act(async () => {
      screen.getByRole("button").click();
    });

    // Submitted data contains new values
    expect(formData.firstName).toBe("Joe");
    expect(formData.lastName).toBe("Bloggs");
  });

  test("$setValue", async () => {
    const harness = createHarness({ defaultValues });

    render(<harness.Form />);

    act(() => {
      harness.formBuilder.fields.firstName.$setValue("Joe");
    });

    expect(harness.values.firstName).toBe("Joe");
  });

  test("$useWatch", async () => {
    const harness = createHarness({ defaultValues }, (builder) => {
      // Option 1: get everything
      const root = builder.fields.$useWatch();
      // Option 2: get subset of fields
      const [firstName, lastName] = builder.fields.$useWatch({
        name: ["firstName", "lastName"],
      });
      // Option 3: get specific field
      const firstNameAlt = builder.fields.firstName.$useWatch();
      return (
        <>
          <div data-testid="watched-root">{JSON.stringify(root)}</div>
          <div data-testid="watched-first-name">{firstName}</div>
          <div data-testid="watched-last-name">{lastName}</div>
          <div data-testid="watched-first-name-alt">{firstNameAlt}</div>
        </>
      );
    });

    render(<harness.Form />);

    const firstNameInput = screen.getByLabelText("first-name-input");

    await act(async () => {
      await userEvent.clear(firstNameInput);
      await userEvent.type(firstNameInput, "Joe");
    });

    const watchedRoot = screen.getByTestId("watched-root");
    const watchedFirstName = screen.getByTestId("watched-first-name");
    const watchedLastName = screen.getByTestId("watched-last-name");
    const watchedFirstNameAlt = screen.getByTestId("watched-first-name-alt");

    await waitFor(() => {
      expect(watchedRoot).toHaveTextContent(
        JSON.stringify({ firstName: "Joe", lastName: "Smith" })
      );
      expect(watchedRoot).toHaveTextContent("Smith");
      expect(watchedFirstName).toHaveTextContent("Joe");
      expect(watchedLastName).toHaveTextContent("Smith");
      expect(watchedFirstNameAlt).toHaveTextContent("Joe");
    });
  });
});
