import React, { FC, ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SubmitHandler } from "react-hook-form";

import {
  useFormBuilder,
  UseFormBuilderProps,
  UseFormBuilderReturn,
} from "./formbuilder";

describe("useFormBuilder", () => {
  interface FormData {
    person: {
      firstName: string;
      lastName: string;
    };
  }

  const createHarness = (
    props: UseFormBuilderProps<FormData>,
    renderChild?: (builder: UseFormBuilderReturn<FormData>) => ReactNode
  ) => {
    const returnValue: {
      Form: typeof Form;
      formBuilder: UseFormBuilderReturn<FormData>;
      values: FormData;
    } = {} as any;

    const Form: FC<{
      onSubmit?: SubmitHandler<FormData>;
    }> = ({ onSubmit }) => {
      returnValue.formBuilder = useFormBuilder<FormData>(props);
      const { fields, handleSubmit, watch } = returnValue.formBuilder;
      returnValue.values = watch();
      return (
        <form onSubmit={onSubmit != null ? handleSubmit(onSubmit) : undefined}>
          <input
            {...fields.person.firstName({ required: true })}
            aria-label="first-name-input"
          />
          <input
            {...fields.person.lastName({ required: true })}
            aria-label="last-name-input"
          />
          <button type="submit">Submit</button>
          {renderChild != null ? renderChild(returnValue.formBuilder) : null}
        </form>
      );
    };

    returnValue.Form = Form;

    return returnValue;
  };

  const defaultValues: FormData = {
    person: {
      firstName: "John",
      lastName: "Smith",
    },
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
    expect(formData.person.firstName).toBe("Joe");
    expect(formData.person.lastName).toBe("Bloggs");
  });

  test("$setValue", async () => {
    const harness = createHarness({ defaultValues });

    render(<harness.Form />);

    act(() => {
      harness.formBuilder.fields.person.firstName.$setValue("Joe");
    });

    expect(harness.values.person.firstName).toBe("Joe");
  });

  test("$useWatch", async () => {
    const harness = createHarness({ defaultValues }, (builder) => {
      // Option 1: get everything
      const root = builder.fields.$useWatch();
      // Option 2: get subset of fields
      const [firstName, lastName] = builder.fields.person.$useWatch({
        name: ["firstName", "lastName"],
      });
      // Option 3: get specific field
      const firstNameAlt = builder.fields.person.firstName.$useWatch();
      return (
        <>
          <div data-testid="watched-root">{JSON.stringify(root)}</div>
          <div data-testid="watched-first-name">{firstName}</div>
          <div data-testid="watched-last-name">{lastName}</div>
          <div data-testid="watched-first-name-alt">{firstNameAlt}</div>
        </>
      );
    });

    render(<harness.Form onSubmit={() => {}} />);

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
        JSON.stringify({ person: { firstName: "Joe", lastName: "Smith" } })
      );
      expect(watchedRoot).toHaveTextContent("Smith");
      expect(watchedFirstName).toHaveTextContent("Joe");
      expect(watchedLastName).toHaveTextContent("Smith");
      expect(watchedFirstNameAlt).toHaveTextContent("Joe");
    });
  });

  test("formState", async () => {
    const harness = createHarness({ defaultValues }, (builder) => {
      const isDirty = builder.formState.isDirty;

      return (
        <div data-testid="form-state-is-dirty">
          {isDirty ? "true" : "false"}
        </div>
      );
    });

    render(<harness.Form />);

    const firstNameInput = screen.getByLabelText("first-name-input");

    const formStateIsDirty = screen.getByTestId("form-state-is-dirty");

    expect(formStateIsDirty).toHaveTextContent("false");

    await act(async () => {
      await userEvent.clear(firstNameInput);
      await userEvent.type(firstNameInput, "Joe");
    });

    await waitFor(() => {
      expect(formStateIsDirty).toHaveTextContent("true");
    });
  });

  test("$useState", async () => {
    const handleSubmit: SubmitHandler<FormData> = (data) => {};

    const harness = createHarness({ defaultValues }, (builder) => {
      const { dirty, errors } = builder.fields.person.firstName.$useState();
      return (
        <div>
          <div data-testid="is-dirty">{JSON.stringify(dirty)}</div>
          <div data-testid="error-type">{errors?.type}</div>
        </div>
      );
    });

    render(<harness.Form onSubmit={handleSubmit} />);

    const firstNameInput = screen.getByLabelText("first-name-input");
    const isDirty = screen.getByTestId("is-dirty");
    const errorType = screen.getByTestId("error-type");

    await act(async () => {
      await userEvent.clear(firstNameInput);
    });

    await act(async () => {
      screen.getByRole("button").click();
    });

    await waitFor(() => {
      expect(isDirty).toHaveTextContent("true");
      expect(errorType).toHaveTextContent("required");
    });
  });
});
