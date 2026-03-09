# Visibility

Conditionally show or hide components based on state values and logic.

## State-Based Visibility

Show/hide based on state values. Use `$state` with a JSON Pointer path:

```json
{
  "type": "Alert",
  "props": { "message": "Form has errors" },
  "visible": { "$state": "/form/hasErrors" }
}
```

Visible when `/form/hasErrors` is truthy.

### Negation

Use `not: true` to invert a condition:

```json
{
  "type": "WelcomeBanner",
  "visible": { "$state": "/user/hasSeenWelcome", "not": true }
}
```

Visible when `/user/hasSeenWelcome` is falsy.

## Auth-Based Visibility

Show/hide based on authentication state. Expose your auth state in the state model (e.g. at `/auth/isSignedIn`):

```json
{
  "type": "AdminPanel",
  "visible": { "$state": "/auth/isSignedIn" }
}
```

For signed-out only:

```json
{
  "type": "LoginPrompt",
  "visible": { "$state": "/auth/isSignedIn", "not": true }
}
```

## Comparison Operators

Compare a state value to a literal or another state path. Use **one operator per condition** -- if multiple are provided, only the first one is evaluated (precedence: `eq` > `neq` > `gt` > `gte` > `lt` > `lte`). Add `"not": true` to invert the result of any condition.

```json
// Equal
{
  "visible": { "$state": "/user/role", "eq": "admin" }
}

// Not equal
{
  "visible": { "$state": "/tab", "neq": "home" }
}

// Greater than
{
  "visible": { "$state": "/cart/total", "gt": 100 }
}

// Greater than or equal
{
  "visible": { "$state": "/cart/itemCount", "gte": 1 }
}

// Less than
{
  "visible": { "$state": "/cart/total", "lt": 1000 }
}

// Less than or equal
{
  "visible": { "$state": "/cart/itemCount", "lte": 10 }
}
```

Comparison values can be literals or state references:

```json
{
  "visible": {
    "$state": "/user/balance",
    "gte": { "$state": "/order/minimum" }
  }
}
```

## Combining Conditions (AND)

Place multiple conditions in an array for implicit AND:

```json
{
  "type": "SubmitButton",
  "visible": [{ "$state": "/form/isValid" }, { "$state": "/form/hasChanges" }]
}
```

All conditions must be true for the element to be visible.

## OR Conditions

Use `$or` when at least one condition should be true:

```json
{
  "type": "SpecialOffer",
  "visible": {
    "$or": [{ "$state": "/user/isVIP" }, { "$state": "/cart/total", "gt": 200 }]
  }
}
```

Visible when the user is VIP **or** the cart total exceeds 200. `$or` can contain any visibility conditions, including nested arrays (AND) and comparisons.

## Explicit AND

Use `$and` when you need to nest AND logic inside `$or`:

```json
{
  "type": "PromoCard",
  "visible": {
    "$or": [
      {
        "$and": [
          { "$state": "/user/isVIP" },
          { "$state": "/cart/total", "gt": 50 }
        ]
      },
      { "$state": "/promo/active" }
    ]
  }
}
```

For top-level AND, the implicit array form is simpler: `[condition, condition]`. Use `$and` only when nesting inside `$or`.

## Always / Never

Use boolean literals for constant visibility:

```json
{
  "type": "Footer",
  "visible": true
}
```

```json
{
  "type": "DeprecatedPanel",
  "visible": false
}
```

## Repeat-Scoped Conditions

Inside a [repeat](/docs/data-binding#repeat), use `$item` and `$index` conditions to show/hide based on the current item:

### `$item` — Condition on item field

```json
{
  "type": "Badge",
  "props": { "label": "Overdue" },
  "visible": { "$item": "isOverdue" }
}
```

With comparison:

```json
{
  "type": "DiscountTag",
  "visible": { "$item": "price", "gt": 100 }
}
```

### `$index` — Condition on array index

```json
{
  "type": "Divider",
  "visible": { "$index": true, "gt": 0 }
}
```

This shows the divider for every item except the first (index 0).

`$item` and `$index` conditions support the same comparison operators as `$state` (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `not`).

## Complex Example

```json
{
  "type": "RefundButton",
  "props": { "label": "Process Refund" },
  "visible": [
    { "$state": "/auth/isSignedIn" },
    { "$state": "/user/role", "eq": "support" },
    { "$state": "/order/amount", "gt": 0 },
    { "$state": "/order/isRefunded", "not": true }
  ]
}
```

## Quick Reference

Comparison values can be literals or state references for state-to-state comparisons:

```json
{ "$state": "/a", "eq": { "$state": "/b" } }
```

## Usage with React

In `@json-render/react`, wrap your app with `VisibilityProvider` to enable conditional rendering. The `Renderer` handles visibility automatically — elements with unmet conditions are not rendered.

```tsx
function App() {
  return (
    <StateProvider initialState={data}>
      <VisibilityProvider>
        {/* Components can now use visibility conditions */}
      </VisibilityProvider>
    </StateProvider>
  );
}
```

For advanced use cases, the `useIsVisible` hook lets you evaluate visibility conditions programmatically:

```tsx
function ConditionalContent({ condition, children }) {
  const isVisible = useIsVisible(condition);

  if (!isVisible) return null;
  return <div>{children}</div>;
}
```

See the [@json-render/react API reference](/docs/api/react) for full details.

## Next

Learn about [form validation](/docs/validation).
