# Custom Schema & Renderer

Build your own schema and renderer with `@json-render/core`.

## Overview

`@json-render/core` is schema-agnostic. While `@json-render/react` provides a ready-to-use schema and renderer, you can create your own to match any JSON structure - whether it's a domain-specific format, an existing protocol, or something entirely custom.

## 1. Define Your Schema

Start by defining the JSON structure your system will use. Here's an example of a simple dashboard schema:

```json
{
  "layout": "grid",
  "columns": 2,
  "widgets": [
    {
      "type": "metric",
      "title": "Revenue",
      "value": "$12,345",
      "trend": "up"
    },
    {
      "type": "chart",
      "title": "Sales",
      "chartType": "line",
      "dataKey": "salesData"
    },
    {
      "type": "table",
      "title": "Recent Orders",
      "columns": ["id", "customer", "amount"],
      "dataKey": "orders"
    }
  ]
}
```

## 2. Create the Catalog

Define a catalog that describes your components and validates props using `defineCatalog` — see [Catalog](/docs/catalog).

```typescript

  components: {
    metric: {
      description: 'Displays a single metric value',
      props: z.object({
        title: z.string(),
        value: z.string(),
        trend: z.enum(['up', 'down', 'flat']).optional(),
        change: z.string().optional(),
      }),
    },
    chart: {
      description: 'Renders a chart visualization',
      props: z.object({
        title: z.string(),
        chartType: z.enum(['line', 'bar', 'pie', 'area']),
        dataKey: z.string(),
        height: z.number().optional(),
      }),
    },
    table: {
      description: 'Displays tabular data',
      props: z.object({
        title: z.string(),
        columns: z.array(z.string()),
        dataKey: z.string(),
        pageSize: z.number().optional(),
      }),
    },
    text: {
      description: 'Displays text content',
      props: z.object({
        content: z.string(),
        variant: z.enum(['heading', 'body', 'caption']).optional(),
      }),
    },
  },
});
```

## 3. Define the Root Schema

Create a schema for the overall document structure:

```typescript

const WidgetSchema = z.object({
  type: z.string(),
  title: z.string().optional(),
  // Additional props validated by catalog
}).passthrough();

  layout: z.enum(['grid', 'stack', 'tabs']),
  columns: z.number().optional(),
  widgets: z.array(WidgetSchema),
});

```

## 4. Build the Renderer

Create a renderer that maps your schema to React components:

```tsx

// Widget component registry
const widgetComponents: Record<string, React.FC<any>> = {
  metric: ({ title, value, trend, change }) => (
  ),

  chart: ({ title, chartType, data }) => (
  ),

  table: ({ title, columns, data }) => (
  ),

  text: ({ content, variant = 'body' }) => {
    const className = {
      heading: 'text-xl font-bold',
      body: 'text-base',
      caption: 'text-sm text-muted-foreground',
    }[variant];
    return <p className={className}>{content}</p>;
  },
};

// Main renderer
  spec,
  data = {},
}: {
  spec: Dashboard;
  data?: Record<string, any>;
}) {
  const layoutClass = {
    grid: `grid gap-4 ${spec.columns ? `grid-cols-${spec.columns}` : 'grid-cols-2'}`,
    stack: 'flex flex-col gap-4',
    tabs: 'space-y-4',
  }[spec.layout];

  return (
  );
}
```

## 5. Generate LLM Prompts

Use the catalog to generate system prompts for AI:

```typescript
const systemPrompt = dashboardCatalog.prompt({
  customRules: [
    "Use metric widgets for single KPI values",
    "Use chart widgets for time-series data",
    "Use table widgets for lists of records",
    "Limit dashboards to 6 widgets maximum",
  ],
});

// Use with any LLM
const response = await generateText({
  model: "gpt-4",
  system: systemPrompt,
  prompt: "Create a sales dashboard with revenue, orders, and a chart",
});
```

## 6. Validate Specs

Validate incoming specs against your schema. Use `catalog.validate()` to check AI output against the catalog's Zod schema:

```typescript
function validateDashboard(spec: unknown) {
  // Validate root structure
  const rootResult = DashboardSchema.safeParse(spec);
  if (!rootResult.success) {
    return { valid: false, errors: rootResult.error.errors };
  }

  // Validate each widget's props against the catalog
  const result = dashboardCatalog.validate(spec);
  if (!result.success) {
    return { valid: false, errors: result.error.errors };
  }

  return { valid: true, errors: [] };
}
```

## Usage Example

```tsx
'use client';


const initialSpec: Dashboard = {
  layout: 'grid',
  columns: 2,
  widgets: [
    { type: 'metric', title: 'Revenue', value: '$12,345', trend: 'up' },
    { type: 'metric', title: 'Orders', value: '156', trend: 'up' },
    { type: 'chart', title: 'Sales Trend', chartType: 'line', dataKey: 'sales' },
    { type: 'table', title: 'Recent Orders', columns: ['id', 'customer', 'amount'], dataKey: 'orders' },
  ],
};

const data = {
  sales: [/* chart data */],
  orders: [
    { id: '001', customer: 'Acme Inc', amount: '$500' },
    { id: '002', customer: 'Globex', amount: '$750' },
  ],
};

  const [spec, setSpec] = useState(initialSpec);

  return <DashboardRenderer spec={spec} data={data} />;
}
```

## Next

See how to integrate with [A2UI](/docs/a2ui) or [Adaptive Cards](/docs/adaptive-cards) protocols.
