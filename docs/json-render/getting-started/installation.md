# Installation

Install the core package plus your renderer of choice.

## For React UI

```bash
pnpm add @json-render/core @json-render/react
```

Peer dependencies: `react ^19.0.0` and `zod ^4.0.0`.

```bash
pnpm add react zod
```

## For Vue

```bash
pnpm add @json-render/core @json-render/vue
```

Peer dependencies: `vue ^3.5.0` and `zod ^4.0.0`.

```bash
pnpm add vue zod
```

## For Svelte

```bash
pnpm add @json-render/core @json-render/svelte
```

Peer dependencies: `svelte ^5.0.0` and `zod ^4.0.0`.

```bash
pnpm add svelte zod
```

## For React UI with shadcn/ui

Pre-built components for fast prototyping and production use:

```bash
pnpm add @json-render/core @json-render/react @json-render/shadcn
```

Requires Tailwind CSS in your project. See the [@json-render/shadcn API reference](/docs/api/shadcn) for usage.

## For React Native

```bash
pnpm add @json-render/core @json-render/react-native
```

## For Remotion Video

```bash
pnpm add @json-render/core @json-render/remotion remotion @remotion/player
```

## For React Email

```bash
pnpm add @json-render/core @json-render/react-email @react-email/components @react-email/render
```

## For External State Management (Optional)

If you want to wire json-render to an existing state management library instead of the built-in store, install the adapter for your library:

```bash
pnpm add @json-render/zustand
```

```bash
pnpm add @json-render/redux
```

```bash
pnpm add @json-render/jotai
```

```bash
pnpm add @json-render/xstate
```

See the [Data Binding](/docs/data-binding#external-store-controlled-mode) guide for usage.

## For AI Integration

To use json-render with AI models, you'll also need the Vercel AI SDK:

```bash
pnpm add ai
```
