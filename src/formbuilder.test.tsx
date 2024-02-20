import React, { FC, ReactNode } from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FieldValues, SubmitHandler } from "react-hook-form";

import {
  FormBuilder,
  useFormBuilder,
  UseFormBuilderProps,
  UseFormBuilderReturn,
} from "./formbuilder";

describe("useFormBuilder", () => {
  // Note: Do not destructure the return value, as some of its members are assigned only after the form has been
  // rendered.
  const createHarness = <TFormValues extends FieldValues>(
    props: UseFormBuilderProps<TFormValues>,
    renderFormComponents: (fields: FormBuilder<TFormValues>) => ReactNode
  ) => {
    const returnValue: {
      Form: typeof Form;
      builder: UseFormBuilderReturn<TFormValues>;
      values: TFormValues;
    } = {} as any;

    const Form: FC<{
      onSubmit?: SubmitHandler<TFormValues>;
    }> = ({ onSubmit }) => {
      const builder = useFormBuilder<TFormValues>(props);

      returnValue.builder = builder;
      returnValue.values = builder.watch();

      return (
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        <form onSubmit={builder.handleSubmit(onSubmit ?? (() => {}))}>
          {renderFormComponents(builder.fields)}
          <button type="submit">Submit</button>
        </form>
      );
    };

    returnValue.Form = Form;

    return returnValue;
  };

  beforeAll(() => {
    userEvent.setup();
  });

  test("Two-way binding", async () => {
    let formData = { ...person };

    const handleSubmit: SubmitHandler<PersonData> = (data) => {
      formData = data;
    };

    const harness = createHarness<PersonData>(
      { defaultValues: person },
      renderPersonFields
    );

    render(<harness.Form onSubmit={handleSubmit} />);

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
    const harness = createHarness<PersonData>(
      {
        defaultValues: person,
      },
      renderPersonFields
    );

    render(<harness.Form />);

    act(() => {
      harness.builder.fields.firstName.$setValue("Joe");
    });

    expect(harness.values.firstName).toBe("Joe");
  });

  test("$useWatch", async () => {
    const { Form } = createHarness({ defaultValues: person }, (fields) => {
      // Option 1: get everything
      const root = fields.$useWatch();
      // Option 2: get subset of fields
      const [firstName, lastName] = fields.$useWatch({
        name: ["firstName", "lastName"],
      });
      // Option 3: get specific field
      const firstNameAlt = fields.firstName.$useWatch();
      return (
        <>
          {renderPersonFields(fields)}
          <div data-testid="watched-root">{JSON.stringify(root)}</div>
          <div data-testid="watched-first-name">{firstName}</div>
          <div data-testid="watched-last-name">{lastName}</div>
          <div data-testid="watched-first-name-alt">{firstNameAlt}</div>
        </>
      );
    });

    render(<Form />);

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
        JSON.stringify({
          ...person,
          firstName: "Joe",
        })
      );
      expect(watchedRoot).toHaveTextContent("Smith");
      expect(watchedFirstName).toHaveTextContent("Joe");
      expect(watchedLastName).toHaveTextContent("Smith");
      expect(watchedFirstNameAlt).toHaveTextContent("Joe");
    });
  });

  test("$useState", async () => {
    const harness = createHarness({ defaultValues: person }, (fields) => {
      const { dirty, errors } = fields.firstName.$useState();
      return (
        <>
          {renderPersonFields(fields)}
          <div data-testid="is-dirty">{JSON.stringify(dirty)}</div>
          <div data-testid="error-type">{errors?.type}</div>
        </>
      );
    });

    render(<harness.Form />);

    const firstNameInput = screen.getByLabelText("first-name-input");
    const isDirty = screen.getByTestId("is-dirty");
    const errorType = screen.getByTestId("error-type");

    await act(async () => {
      await userEvent.clear(firstNameInput);
      screen.getByRole("button").click();
    });

    await waitFor(() => {
      expect(isDirty).toHaveTextContent("true");
      expect(errorType).toHaveTextContent("required");
    });
  });

  test("$useFieldArray", async () => {
    const harness = createHarness(
      {
        defaultValues: {
          list: [
            { id: "0", action: "frobnicate" },
            { id: "1", action: "skedaddle" },
          ],
        },
      },
      (fields) => {
        const { fields: arrayFields } = fields.list.$useFieldArray();

        return (
          <div>
            {arrayFields.map((field, i) => (
              <input
                key={field.$key}
                {...field.action()}
                aria-label={`action-${i}`}
              />
            ))}
          </div>
        );
      }
    );

    render(<harness.Form />);

    await waitFor(() => {
      expect(screen.getByLabelText("action-0")).toHaveValue("frobnicate");
      expect(screen.getByLabelText("action-1")).toHaveValue("skedaddle");
    });
  });
});

interface PersonData {
  firstName: string;
  lastName: string;
}

const person: PersonData = {
  firstName: "John",
  lastName: "Smith",
};

const renderPersonFields = (fields: FormBuilder<PersonData>) => {
  return (
    <>
      <input
        {...fields.firstName({ required: true })}
        aria-label="first-name-input"
      />
      <input
        {...fields.lastName({ required: true })}
        aria-label="last-name-input"
      />
    </>
  );
};
