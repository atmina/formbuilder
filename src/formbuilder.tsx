import {
  ErrorOption,
  FieldPath,
  FieldPathValue,
  FieldPathValues,
  FieldValues,
  InternalFieldName,
  Message,
  Primitive,
  SetFocusOptions,
  useController,
  UseControllerProps,
  UseControllerReturn,
  useFieldArray,
  UseFieldArrayReturn,
  useForm,
  UseFormProps,
  UseFormRegisterReturn,
  UseFormReturn,
  UseFormSetError,
  useWatch,
  UseWatchProps,
  ValidationRule,
  ValidateResult,
  FieldArrayPath,
} from "react-hook-form";
import { useMemo } from "react";

// Future considerations:
// - improve the stack trace on FormBuilder<T> type mismatch
//   (currently it is big and scary)
// - figure out how to get FormBuilder<any> to work

/**
 * Represents a field or collection of fields.
 *
 * Can be called which is equivalent to calling RHF's `register()` with the corresponding field name.
 *
 * Use `FormBuilder<T>` as the expected prop to build typed form field
 * components (e.g. `FormBuilder<number>` for numeric inputs).
 */
export type FormBuilder<T> = FormBuilderRegisterFn<T> & {
  // Setting T via alias U avoids contravariance in return value
  // (See below for explanation)
  $useController<U = T>(
    props?: Omit<UseControllerProps, "name" | "control">
  ): UseControllerReturn<{ __: U }, U extends Primitive ? "__" : "__">;
  $useWatch<
    TValues = T,
    TFieldName extends FieldPath<TValues> = FieldPath<TValues>
  >(
    props?: FormBuilderUseWatchCommonProps & { name: TFieldName }
  ): FieldPathValue<TValues, TFieldName>;
  $useWatch<
    TValues = T,
    TFieldNames extends readonly FieldPath<TValues>[] = readonly FieldPath<TValues>[]
  >(
    props?: FormBuilderUseWatchCommonProps & { name: readonly [...TFieldNames] }
  ): FieldPathValues<TValues, TFieldNames>;
  $useWatch<U = T>(props?: FormBuilderUseWatchCommonProps): U;
  $setValue(value: T): void;
  $setError(
    error: ErrorOption,
    options: Parameters<UseFormSetError<FieldValues>>[2]
  ): void;
  $setFocus(options: SetFocusOptions): void;
} & (T extends Primitive
    ? // Leaf node
      unknown
    : T extends Array<infer U>
    ? {
        [K: number]: FormBuilder<U>;
        $useFieldArray<TItem = U, TKey extends string = "key">(
          props?: FormBuilderUseFieldArrayProps<TKey>
        ): UseFieldArrayReturn<
          { __: TItem[] },
          TItem extends Primitive ? never : "__",
          TKey
        >;
      }
    : {
        [K in Exclude<keyof T, `${"__"}${string}`>]-?: FormBuilder<T[K]>;
      });

/*
  Using T as a generic function parameter makes it contravariant. This causes
  unexpected results when trying to match concrete `FormBuilder<T>`s
  against each other. Consider this example:

  declare type A = {foo: string};
  declare type B = {foo: string, bar: string};
  declare let ra: FormBuilder<A>;
  declare let rb: FormBuilder<B>;
  ra = rb; // Error!

  (Contravariance here means A is expected to be assignable to B)

  However, unlike functions, method parameters in TypeScript are bivariant
  (mainly because a lot of existing stuff would break if they weren't). The
  hack is to disguise the function as a method.

  https://stackoverflow.com/questions/52667959

  Proposal: covariance and contravariance generic type arguments annotations
  https://github.com/microsoft/TypeScript/issues/10717
*/

type FormBuilderRegisterFn<T> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  bivarianceHack(options?: RegisterOptions<T>): UseFormRegisterReturn;
}["bivarianceHack"];

/*
  Create a recursive proxy object that returns a partially applied `register`
  from `useForm` with `name` bound to the current position (dotted path) in the
  object.

  RHF functions are exposed as methods on this field (e.g. `useFieldArray()`).

  In a nutshell:

  ```
  const fields = createFormBuilder(register, [])
  fields.foo.bar == (options) => register('foo.bar', options)
  fields.foo.bar.useController == (props) => useController({name: 'foo.bar', ...props})
  fields.array[0] == (options) => register('array.0', options)
  fields.array.useFieldArray == (props) => useFieldArray({name: 'array', ...props})
  String(fields.foo.bar) == 'foo.bar'
  ```
*/
export function createFormBuilder<TFieldValues>(
  methods: UseFormReturn<TFieldValues>,
  path: string[]
): FormBuilder<TFieldValues> {
  const currentPath = path.join(".") as FieldPath<TFieldValues>;
  // Cache generated functions to stabilize references across re-renders.
  const cache: Record<PropertyKey, (...args: any[]) => unknown> = {};
  const { control } = methods;
  return new Proxy(
    ((options?: RegisterOptions<TFieldValues>) => {
      // Calling register with an empty name is not an error in RHF, but it
      // hardly makes sense to do so.
      if (currentPath.length === 0) {
        throw new Error("Cannot call register at the root.");
      }
      return methods.register(currentPath, options as never);
    }) as FormBuilder<TFieldValues>,
    {
      get(target, prop) {
        let useCached = cache[prop];
        if (useCached !== undefined) {
          return useCached;
        }
        switch (prop) {
          case Symbol.toPrimitive:
            // Called when used with `String(...)`.
            useCached = () => currentPath;
            break;
          case "$useFieldArray":
            useCached = (props?: FormBuilderUseFieldArrayProps) =>
              useFieldArray({
                name: currentPath as FieldArrayPath<TFieldValues>,
                keyName: "key",
                control,
                ...props,
              });
            break;
          case "$useController":
            useCached = (
              props?: Omit<UseControllerProps, "name" | "control">
            ) =>
              useController({
                name: currentPath,
                control,
                ...props,
              });
            break;
          case "$useWatch":
            useCached = ({ name, ...rest } = {}) => {
              return useWatch({
                name:
                  name != null
                    ? prependCurrentPath(currentPath, name)
                    : currentPath === ""
                    ? undefined
                    : currentPath,
                control,
                ...rest,
              });
            };
            break;
          case "$setValue":
            // TODO: hide from root (should use reset for that)
            useCached = (value) => {
              methods.setValue(currentPath, value);
            };
            break;
          // TODO: $getValue -> RHF getValues
          case "$setError":
            useCached = (value, options: any) => {
              methods.setError(currentPath, value, options);
            };
            break;
          default:
            // Recurse
            useCached = createFormBuilder<TFieldValues>(methods, [
              ...path,
              prop.toString(),
            ]);
        }
        return (cache[prop] = useCached);
      },
    }
  );
}

// Usable in places where RHF expects a `FieldPath` or `FieldPath[]` parameter.
const prependCurrentPath = (
  currentPath: string,
  name: undefined | string | string[]
): string | string[] => {
  if (currentPath.length === 0) return name ?? "";
  if (typeof name === "string") {
    return `${currentPath}.${name}`;
  } else if (Array.isArray(name)) {
    return name.map((s) => `${currentPath}.${s}`);
  } else {
    return currentPath;
  }
};

export interface UseFormBuilderReturn<
  TFieldValues,
  TContext extends object = object
> extends UseFormReturn<TFieldValues, TContext> {
  fields: FormBuilder<TFieldValues>;
}

/**
 * A type-safe alternative to `useForm()`.
 *
 * @example ```tsx
 * const {fields, ...methods} = useFormBuilder({...});
 *
 * // Spread result the same way as with `register`.
 * <input type='number' {...fields.foo.bar({min: ..., max: ...})} />
 *
 * // Field array (only available on array values, name is pre-filled)
 * const {fields, ...arrayMethods} = fields.things.useFieldArray({...});
 *
 * // Obtain the dotted path (e.g. for `setValue`)
 * const path = String(fields.foo.bar); // 'foo.bar'
 * ```
 * @param props additional props passed to `useForm()`
 * @see FormBuilder
 */
export function useFormBuilder<
  TFieldValues extends FieldValues = FieldValues,
  TContext extends object = object
>(
  props?: UseFormProps<TFieldValues, TContext>
): UseFormBuilderReturn<TFieldValues, TContext> {
  const methods = useForm<TFieldValues, TContext>(props);
  const fields = useMemo(
    () => createFormBuilder<TFieldValues>(methods, []),
    [methods.register, methods.control]
  );

  return { fields, ...methods };
}

// Validate is another source of contravariance.
type Validate<T> = {
  // eslint-disable-next-line @typescript-eslint/method-signature-style
  bivarianceHack(value: T): ValidateResult;
}["bivarianceHack"];

// Copied straight from RHF and then simplified to not use the field path
// resolution. This needs to be kept in sync with RHF, but hopefully reduces
// load on the typechecker.
type RegisterOptions<T> = Partial<{
  required: Message | ValidationRule<boolean>;
  min: ValidationRule<number | string>;
  max: ValidationRule<number | string>;
  maxLength: ValidationRule<number>;
  minLength: ValidationRule<number>;
  pattern: ValidationRule<RegExp>;
  validate: Validate<T> | Record<string, Validate<T>>;
  valueAsNumber: boolean;
  valueAsDate: boolean;
  value: T;
  setValueAs: (value: unknown) => T;
  shouldUnregister?: boolean;
  onChange?: (event: Event) => void;
  onBlur?: (event: Event) => void;
  disabled: boolean;
  deps: InternalFieldName[];
}>;

interface FormBuilderUseFieldArrayProps<TKey extends string = "key"> {
  keyName?: TKey;
  shouldUnregister?: boolean;
}

type FormBuilderUseWatchCommonProps = Omit<
  UseWatchProps<never>,
  "name" | "control" | "defaultValue"
>;
