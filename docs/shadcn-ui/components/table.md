# Table - shadcn/ui

[Docs](/docs)

Table

# Table

A responsive table component.

PreviewCode

Style: Default

Open in

Copy

A list of your recent invoices.

Invoice

Status

Method

Amount

INV001

Paid

Credit Card

$250.00

INV002

Pending

PayPal

$150.00

INV003

Unpaid

Bank Transfer

$350.00

INV004

Paid

Credit Card

$450.00

INV005

Paid

PayPal

$550.00

INV006

Pending

Bank Transfer

$200.00

INV007

Unpaid

Credit Card

$300.00

Total

$2,500.00

## [](#installation)Installation

CLIManual

pnpmnpmyarnbun

```
pnpm dlx shadcn@latest add table
```

Copy

## [](#usage)Usage

```
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
```

Copy

```
<Table>
  <TableCaption>A list of your recent invoices.</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead className="w-[100px]">Invoice</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Method</TableHead>
      <TableHead className="text-right">Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell className="font-medium">INV001</TableCell>
      <TableCell>Paid</TableCell>
      <TableCell>Credit Card</TableCell>
      <TableCell className="text-right">$250.00</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

Copy

## [](#data-table)Data Table

You can use the `<Table />` component to build more complex data tables. Combine it with [@tanstack/react-table](https://tanstack.com/table/v8) to create tables with sorting, filtering and pagination.

See the [Data Table](/docs/components/data-table) documentation for more information.

You can also see an example of a data table in the [Tasks](/examples/tasks) demo.

[Switch](/docs/components/switch)[Tabs](/docs/components/tabs)

On This Page

- [Installation](#installation)
- [Usage](#usage)
- [Data Table](#data-table)

Deploy your shadcn/ui app on Vercel

Trusted by OpenAI, Sonos, Chick-fil-A, and more.

Vercel provides tools and infrastructure to deploy apps and features at scale.

Deploy Now[Deploy to Vercel](https://vercel.com/new?utm_source=shadcn_site&utm_medium=web&utm_campaign=docs_cta_deploy_now_callout)
