# FormBuilder

Write composable and type-safe form components, including subforms and field level components. Powered by
[React Hook Form](https://react-hook-form.com/).

## Installation

```shell
npm install @atmina/formbuilder
# or
yarn add @atmina/formbuilder
```

## Usage

`FormBuilder` exposes a single hook `useFormBuilder` which is mostly compatible with `useForm` from `react-hook-form`.
It contains an additional member, `fields`, which represents an alternative, object-oriented API on top of React Hook
Form. Each field in the form data can be accessed as a property, including nested fields. The field can be called as a
function to [register](https://react-hook-form.com/api/useform/register/) an input. It also exposes RHF functions via 
field-level methods, e.g. `$setValue`. These methods are prefixed with `$` to prevent potential conflicts with form
data members.

```tsx
import { useFormBuilder } from '@atmina/formbuilder';

interface Address {
    state: string;
    city: string;
    street: string;
    zip: string;
}

const App = () => {
    const {fields, handleSubmit} = useFormBuilder<{name: string, address: Address}>();
    
    const handleFormSubmit = handleSubmit((data) => {
       console.log(data);
    });
    
    return (
        <form onSubmit={handleFormSubmit}>
            <input {...fields.name()} />
            <input {...fields.address.city()} />
            {/* etc. */}
        </form>
    );
    
    
}
```

## Fields

You can create components that encapsulate a single (typed) field by accepting a `FormBuilder<T>` prop  where `T` is
the type of the field. We like to call this `on` or `field`, but you are free to name it however you like.

```tsx
import { FC } from "react";

const TextField: FC<{on: FormBuilder<string>, label: string}> = ({on: field}) => {
    return <div>
        <label>
            <span>{label}</span>
            <input type="text" {...field()} />
        </label>
        <button type="button" onClick={() => field.$setValue(getRandomName())}>
          Randomize
        </button>
    </div>
}
```

The field component would be used like this:

```diff
-   <input type="text" {...field.name()} />
+   <TextField label="State" on={fields.name} />
```

This ensures that the `TextField` component can only accept fields typed as strings, resulting in a type error
otherwise.

## Subforms

You can create components which encapsulate a group of related fields, such as an address. Subforms are useful for
composition, letting you piece together complex data structures and adding a lot of reusability to your forms.

```tsx
import { FC } from "react";

const AddressSubform: FC<{field: FormBuilder<Address>}> = ({field}) => {
    return <div>
        <TextField label="State" field={field.state} />
        <TextField label="City" field={field.city} />
        {/* etc. */}
    </div>
}
```

## Field arrays

Fields which are typed as arrays provide a `$useFieldArray()` hook which can be used to map over the contents, as well
as mutate them using operations such as `append`, `insert`, `move` and `remove`.

The `fields` returned by `$useFieldArray` are themselves `FormBuilder`s that can be registered on inputs or passed to
other Subform components.

```tsx
import { FC } from "react";

const AddressesSubform: FC<{field: FormBuilder<Person[]>}> = ({field}) => {
    const {fields, append} = field.$useFieldArray();
    const add = () => {
        append({state: '', city: '', /* etc. */});
    }
    return <div>
        {fields.map(f => <AddressSubForm key={f.$key} field={f} />)}
        <button onClick={add}>Add new address</button>
    <div>
}
```

The `$key` contains a unique id for the array item and must be passed as the `key` when [rendering the list](https://react.dev/learn/rendering-lists).

Note: Field arrays are intended for use with arrays of objects. When dealing with arrays of primitives, you can either
wrap the primitive in an object, or use a controller (`$useController`) to implement your own array logic.

For more information, see the React Hook Form docs on [`useFieldArray`](https://react-hook-form.com/docs/usefieldarray).

## Discriminating unions

In case of a form that contains fields with object unions, the `$discriminate()` function may be used to narrow the type
using a specific member like this:

```tsx
import { FC } from 'react';

type DiscriminatedForm = 
    | { __typename: 'foo'; foo: string; }
    | { __typename: 'bar'; bar: number; }

const DiscriminatedSubform: FC<{field: FormBuilder<DiscriminatedForm>}> = ({field}) => {
    const fooForm = field.$discriminate('__typename', 'foo');
    
    return <input {...fooForm.foo()} />;
};
```

> [!IMPORTANT]
> `$discriminate` currently does **not** perform any runtime checks, it's strictly used for type narrowing at this time.

## Compatibility with `useForm`

Currently, `useFormBuilder` is almost compatible with `useForm`. This means you get the entire bag of tools provided by
`useForm`, in addition to the `fields` API. This provides an escape hatch for use cases not yet covered by
`useFormBuilder`. However, future versions of the library may see us diverging further from `useForm` in an effort to
streamline this API and increase its type-safety.


## License

MIT
