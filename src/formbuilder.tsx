/* eslint-disable @typescript-eslint/no-explicit-any */

import {useMemo} from 'react';
import {
  type BrowserNativeObject,
  type ErrorOption,
  type FieldArrayPath,
  type FieldErrors,
  type FieldNamesMarkedBoolean,
  type FieldPath,
  type FieldPathValues,
  type FieldValues,
  type GlobalError,
  type InternalFieldName,
  type Message,
  type Primitive,
  type SetFocusOptions,
  type UseControllerProps,
  type UseControllerReturn,
  type UseFieldArrayReturn,
  type UseFormProps,
  type UseFormRegisterReturn,
  type UseFormReturn,
  type UseFormSetError,
  type UseFormStateProps,
  type UseWatchProps,
  type ValidateResult,
  type ValidationRule,
  get,
  useController,
  useFieldArray,
  useFormState,
  useForm,
  useWatch,
} from 'react-hook-form';

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
    props?: Omit<UseControllerProps, 'name' | 'control'>,
  ): UseControllerReturn<
    {__: U},
    U extends Primitive | BrowserNativeObject ? '__' : '__'
  >;
  $useWatch<U = T>(props?: $UseWatchCommonProps): U;
  $useWatch<
    TValues extends FieldValues = T extends FieldValues ? T : FieldValues,
    TFieldNames extends
      readonly FieldPath<TValues>[] = readonly FieldPath<TValues>[],
  >(
    props: $UseWatchCommonProps & {name: readonly [...TFieldNames]},
  ): FieldPathValues<TValues, TFieldNames>;
  $useState<U = T>(
    props?: $UseStateProps,
  ): U extends FieldValues
    ? {
        errors: FieldErrors<U>;
        dirty: Partial<Readonly<FieldNamesMarkedBoolean<U>>>;
      }
    : {errors: GlobalError; dirty: boolean};
  $setValue(value: T): void;
  $setError(
    error: ErrorOption,
    options: Parameters<UseFormSetError<FieldValues>>[2],
  ): void;
  $setFocus(options: SetFocusOptions): void;
  $discriminate<TKey extends MappableKeys<U>, U = T>(
    k: TKey,
  ): {
    [K in MappableValues<U, TKey>]: [K, FormBuilder<Discriminate<U, TKey, K>>];
  }[MappableValues<U, TKey>];
} & (T extends Primitive
    ? // Leaf node
      unknown
    : T extends Array<infer U extends FieldValues>
      ? {
          [K: number]: FormBuilder<U>;
          $useFieldArray<TItem = U>(
            props?: $UseFieldArrayProps<U>,
          ): $UseFieldArrayReturn<TItem>;
        }
      : {
          [K in keyof T]-?: FormBuilder<
            T[K] extends Primitive ? T[K] : NonNullable<T[K]>
          >;
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
  bivarianceHack(options?: RegisterOptions<T>): UseFormRegisterReturn;
}['bivarianceHack'];

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
export function createFormBuilder<TFieldValues extends FieldValues>(
  methods: UseFormReturn<TFieldValues>,
  path: string[],
  // Set if created in $useFieldArray()
  key?: string,
): FormBuilder<TFieldValues> {
  const currentPath = path.join('.') as FieldPath<TFieldValues>;
  // Cache generated functions to stabilize references across re-renders.
  const cache: Record<PropertyKey, (...args: any[]) => unknown> = {};
  const {control} = methods;
  return new Proxy(
    ((options?: RegisterOptions<TFieldValues>) => {
      // Calling register with an empty name is not an error in RHF, but it
      // hardly makes sense to do so.
      if (currentPath.length === 0) {
        throw new Error('Cannot call register at the root.');
      }
      return methods.register(currentPath, options as never);
    }) as FormBuilder<TFieldValues>,
    {
      get(_, prop, receiver) {
        let useCached = cache[prop];
        if (useCached !== undefined) {
          return useCached;
        }
        switch (prop) {
          case Symbol.toPrimitive:
            // Called when used with `String(...)`.
            useCached = () => currentPath;
            break;
          case '$key':
            return key ?? currentPath;
          case '$useFieldArray':
            useCached = (props?: $UseFieldArrayProps<never>) => {
              const {fields, ...rest} = useFieldArray({
                name: currentPath as FieldArrayPath<TFieldValues>,
                keyName: '$key' as const,
                control,
                ...(props as Record<string, unknown>),
              });
              return {
                fields: fields.map(({$key}, i) =>
                  createFormBuilder(methods, [...path, i.toString()], $key),
                ),
                ...rest,
              };
            };
            break;
          case '$useController':
            useCached = (
              props?: Omit<UseControllerProps, 'name' | 'control'>,
            ) =>
              useController<TFieldValues>({
                name: currentPath,
                control,
                ...props,
              });
            break;
          case '$useWatch':
            useCached = ({name, ...rest} = {}) =>
              useWatch({
                name:
                  name != null
                    ? prependCurrentPath(currentPath, name)
                    : currentPath === ''
                      ? undefined
                      : currentPath,
                control,
                ...rest,
              });
            break;
          case '$useState':
            useCached = (props?: $UseStateProps) => {
              const {errors: rootErrors, dirtyFields: rootDirtyFields} =
                useFormState({...props, control, name: currentPath});
              const errors = get(rootErrors, currentPath);
              const dirty = get(rootDirtyFields, currentPath);
              return {errors, dirty};
            };
            break;
          case '$setValue':
            // TODO: hide from root (should use reset for that)
            useCached = (value) => {
              methods.setValue(currentPath, value);
            };
            break;
          // TODO: $getValue -> RHF getValues
          case '$setError':
            useCached = (value, options: any) => {
              methods.setError(currentPath, value, options);
            };
            break;
          case '$discriminate':
            useCached = (fieldName: string) => [
              methods.watch(
                prependCurrentPath(
                  currentPath,
                  fieldName,
                ) as FieldPath<TFieldValues>,
              ),
              receiver,
            ];
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
    },
  );
}

// Usable in places where RHF expects a `FieldPath` or `FieldPath[]` parameter.
const prependCurrentPath = (
  currentPath: string,
  name: undefined | string | string[],
): string | string[] => {
  if (currentPath.length === 0) {
    return name ?? '';
  }
  if (typeof name === 'string') {
    return `${currentPath}.${name}`;
  } else if (Array.isArray(name)) {
    return name.map((s) => `${currentPath}.${s}`);
  }
  return currentPath;
};

export interface UseFormBuilderReturn<
  TFieldValues extends FieldValues,
  TContext extends object = object,
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
 * const {fields, ...arrayMethods} = fields.things.$useFieldArray({...});
 * ```
 * @param props additional props passed to `useForm()`
 * @see FormBuilder
 */
export function useFormBuilder<
  TFieldValues extends FieldValues = FieldValues,
  TContext extends object = object,
>(
  props?: UseFormBuilderProps<TFieldValues, TContext>,
): UseFormBuilderReturn<TFieldValues, TContext> {
  const methods = useForm<TFieldValues, TContext>(props as never);
  const fields = useMemo(
    () => createFormBuilder<TFieldValues>(methods, []),
    [methods],
  );

  return {fields, ...methods};
}

// Validate is another source of contravariance.
type Validate<T> = {
  bivarianceHack(value: T): ValidateResult;
}['bivarianceHack'];

export type RegisterOptions<T> = Partial<{
  required: Message | ValidationRule<boolean>;
  min: ValidationRule<number | string>;
  max: ValidationRule<number | string>;
  maxLength: ValidationRule<number>;
  minLength: ValidationRule<number>;
  validate: Validate<T> | Record<string, Validate<T>>;
  value: T;
  setValueAs: (value: unknown) => T;
  shouldUnregister?: boolean;
  onChange?: (event: Event) => void;
  onBlur?: (event: Event) => void;
  disabled: boolean;
  deps: InternalFieldName | InternalFieldName[];
}> &
  (
    | {
        pattern?: ValidationRule<RegExp>;
        valueAsNumber?: false;
        valueAsDate?: false;
      }
    | {
        pattern?: undefined;
        valueAsNumber?: false;
        valueAsDate?: true;
      }
    | {
        pattern?: undefined;
        valueAsNumber?: true;
        valueAsDate?: false;
      }
  );

type $UseWatchCommonProps = Omit<
  UseWatchProps<never>,
  'name' | 'control' | 'defaultValue'
>;

type $UseStateProps = Omit<UseFormStateProps<never>, 'name' | 'control'>;

type $UseFieldArrayProps<T> = {
  rules?: Pick<
    RegisterOptions<T>,
    'maxLength' | 'minLength' | 'required' | 'validate'
  >;
  shouldUnregister?: boolean;
};

export type $UseFieldArrayReturn<T> = Omit<
  UseFieldArrayReturn<
    {__: T[]},
    T extends Primitive | BrowserNativeObject ? never : '__'
  >,
  'fields'
> & {
  fields: (FormBuilder<T> & {$key: string})[];
};

type Discriminate<T, TKey extends keyof T, TValue> =
  IsUnknown<T> extends 1 ? unknown : Extract<T, Record<TKey, TValue>>;

export type UseFormBuilderProps<
  TFieldValues extends FieldValues = FieldValues,
  TContext = any,
> = UseFormProps<TFieldValues, TContext>;

type IsUnknown<T> = unknown extends T ? (T extends unknown ? 1 : 0) : 0;

// Given object T, return all possible keys of T whose corresponding value type is a PropertyKey
// (string, number or symbol).
type MappableKeys<T> = {
  [K in keyof T]: T[K] extends PropertyKey ? K : never;
}[keyof T];

// Given object T and a key TKey of T, return all possible values in T[TKey] which are PropertyKeys.
type MappableValues<T, TKey extends keyof T> = T[TKey] extends PropertyKey
  ? T[TKey]
  : never;
