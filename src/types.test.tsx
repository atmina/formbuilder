import { expectTypeOf } from "expect-type";
import { FormBuilder } from "./formbuilder";

describe("Types", () => {
  test("FormBuilder", () => {
    // FormBuilder maps fields to functions
    expectTypeOf<FormBuilder<{ foo: string }>["foo"]>().toBeFunction();
    expectTypeOf<FormBuilder<{ foo?: string }>["foo"]>().toBeFunction();
    expectTypeOf<FormBuilder<{ foo?: string }>["foo"]>().not.toBeNullable();

    // Nested fields
    expectTypeOf<
      FormBuilder<{ foo: { bar: string } }>["foo"]["bar"]
    >().toBeFunction();
    expectTypeOf<
      FormBuilder<{ foo: { bar: { baz: string } } }>["foo"]["bar"]["baz"]
    >().toBeFunction();

    // Covariance
    expectTypeOf<FormBuilder<{ foo: string; bar: string }>>().toMatchTypeOf<
      FormBuilder<{ foo: string }>
    >();
    expectTypeOf<FormBuilder<{ foo: string }>>().not.toMatchTypeOf<
      FormBuilder<{ foo: string; bar: string }>
    >();
    expectTypeOf<FormBuilder<{ foo: string; bar: string }[]>>().toMatchTypeOf<
      FormBuilder<{ foo: string }[]>
    >();
    expectTypeOf<FormBuilder<{ foo: string }[]>>().not.toMatchTypeOf<
      FormBuilder<{ foo: string; bar: string }[]>
    >();

    // Optional
    expectTypeOf<FormBuilder<{ foo?: string }>>().toMatchTypeOf<
      FormBuilder<{ foo: string }>
    >();
    expectTypeOf<FormBuilder<{ foo: string }>>().toMatchTypeOf<
      FormBuilder<{ foo?: string }>
    >();

    // Nested optional
    type NestedOptional = FormBuilder<{
      foo?: { bar?: { baz?: string } };
    }>;
    expectTypeOf<NestedOptional["foo"]["bar"]["baz"]>().toMatchTypeOf<
      FormBuilder<string>
    >();

    // Nullable
    expectTypeOf<FormBuilder<string | null>>().toMatchTypeOf<
      FormBuilder<string>
    >();
    expectTypeOf<FormBuilder<string>>().toMatchTypeOf<
      FormBuilder<string | null>
    >();

    // Nested nullable
    type NestedNull = FormBuilder<{
      foo: { bar: { baz: string | null } | null } | null;
    }>;
    expectTypeOf<NestedNull["foo"]["bar"]["baz"]>().toMatchTypeOf<
      FormBuilder<string | null>
    >();

    // Undefined
    expectTypeOf<FormBuilder<string | undefined>>().toMatchTypeOf<
      FormBuilder<string>
    >();
    expectTypeOf<FormBuilder<string>>().toMatchTypeOf<
      FormBuilder<string | undefined>
    >();

    // useWatch helper
    expectTypeOf<
      FormBuilder<{ foo: string }>["foo"]["$useWatch"]
    >().toBeFunction();
    const useWatchFoo: FormBuilder<{ foo: string }>["foo"]["$useWatch"] = (() =>
      "foo") as never;
    expectTypeOf(useWatchFoo()).toEqualTypeOf<string>();
    // useWatch with array of watched subfields
    const useWatchBar: FormBuilder<{
      bar: { baz: string; quux: number };
    }>["bar"]["$useWatch"] = (() => "bar") as never;
    expectTypeOf(useWatchBar({ name: ["baz", "quux"] })).toEqualTypeOf<
      [string, number]
    >();

    // useController helper
    expectTypeOf<
      FormBuilder<{ foo: string }>["foo"]["$useController"]
    >().toBeFunction();
    const useFooController: FormBuilder<{
      foo: string;
    }>["foo"]["$useController"] = (() => ({
      field: {
        value: "foo",
      },
    })) as never;
    expectTypeOf(useFooController().field.value).toEqualTypeOf<string>();

    // useFieldArray helper
    type TFormBuilderWithArray = FormBuilder<{ things: { foo: string }[] }>;
    expectTypeOf<
      TFormBuilderWithArray["things"]["$useFieldArray"]
    >().toBeFunction();
    expectTypeOf<FormBuilder<{ foo: string }>>().not.toHaveProperty(
      "$useFieldArray"
    );
    expectTypeOf<
      FormBuilder<{ things: { foo: string }[]; otherThings: { bar: string }[] }>
    >().toMatchTypeOf<FormBuilder<{ things: { foo: string }[] }>>();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expectTypeOf<FormBuilder<{ foo: string }>>().toMatchTypeOf<
      FormBuilder<any>
    >();
    expectTypeOf<FormBuilder<{ foo: string }>>().toMatchTypeOf<
      FormBuilder<unknown>
    >();

    // Is this desirable? And can it be done in a way that doesn't involve reducing
    // `FormBuilder<any>` to `any`?
    // expectTypeOf<FormBuilder<any>>().toMatchTypeOf<{foo: string}>();

    // Is this possible without breaking everything else?
    // expectTypeOf<FormBuilder<{foo: string}>>().toMatchTypeOf<{foo: string, exists?: boolean}>();

    expectTypeOf<FormBuilder<string>>().not.toMatchTypeOf<
      FormBuilder<{ foo: string }>
    >();

    expectTypeOf<FormBuilder<"one" | "two">>().toMatchTypeOf<
      FormBuilder<string>
    >();

    // Ignored prefixes
    expectTypeOf<FormBuilder<{ foo: string }>>().toMatchTypeOf<
      FormBuilder<{ foo: string; __exists?: boolean }>
    >();
  });
});
