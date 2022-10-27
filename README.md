# FormBuilder

Write composable and type-safe form components at the subform and field level. Powered by
[React Hook Form](https://react-hook-form.com/).

## Usage

`FormBuilder` exposes a single hook `useFormBuilder` which is mostly compatible with `useForm` from `react-hook-form`.
It contains an additional member, `fields`, which represents an alternative, object-oriented API on top of React Hook
Form. Each field in the form data can be accessed as a property, including nested fields. The field can be called as a
function to [register](https://react-hook-form.com/api/useform/register/) an input. It also exposes RHF functions via 
field-level methods, e.g. `$setValue`. These methods are prefixed with `$` to prevent potential conflicts with form
data members.

## Compatibility with `useForm`

Currently, `useFormBuilder` is almost compatible with `useForm`. This means you get the entire bag of tools provided by
`useForm`, in addition to the `fields` API. This provides an escape hatch for use cases not yet covered by
`useFormBuilder`. However, future versions of the library may see us diverging further from `useForm` in an effort to
streamline this API and increase its type-safety.

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
the type of the field. We like to call this `on`, but you are free to name it however you like.

```tsx
import { FC } from "react";

const TextField: FC<{on: FormBuilder<string>, label: string}> = ({field}) => {
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

## License

MIT