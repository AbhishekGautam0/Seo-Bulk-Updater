# SEO Bulk Updater

Embedded Shopify app for updating product search engine titles and
descriptions from a CSV file.

## Purpose

Shopify merchants often need to update SEO metadata for many products at once.
This app lets a merchant upload a spreadsheet, preview the rows, validate SEO
limits, update products through the Shopify Admin API, and keep an import audit
trail.

## CSV Format

The CSV must include these columns:

```csv
product_url,meta_title,meta_description
https://store.myshopify.com/products/example-product,Example SEO Title,Example SEO description.
```

Rules:

- `product_url` must be a Shopify product URL containing `/products/`.
- `meta_title` is required and must be 70 characters or fewer.
- `meta_description` is required and must be 155 characters or fewer.

## Main Flow

1. Merchant opens the SEO Bulk Updater page.
2. Merchant uploads a CSV file.
3. App parses and previews the rows.
4. Merchant starts the update.
5. Server validates each row, extracts the product handle, finds the product,
   and updates the Shopify product SEO fields with `productUpdate`.
6. App stores import history and row-level results in Prisma.
7. Merchant can download the result CSV.

## Required Shopify Scope

```text
write_products
```

The app updates product SEO fields directly. It does not use theme app
extensions, storefront scripts, metafields, or metaobjects for SEO output.

## Development

Install dependencies:

```bash
npm install
```

Prepare Prisma:

```bash
npm run setup
```

Run the Shopify development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Run checks:

```bash
npm run lint
npm run typecheck
```

## Key Files

- `app/routes/app.seo-bulk-updater.jsx` - main upload and update UI
- `app/routes/api/parse-csv.server.jsx` - CSV parsing endpoint
- `app/routes/api/update-seo.server.jsx` - bulk update endpoint
- `app/services/seoService.server.js` - Shopify GraphQL product lookup/update
- `app/utils/csvParser.server.js` - CSV parsing and required-column validation
- `app/utils/validators.server.js` - SEO field and URL validation
- `app/utils/batchProcessor.server.js` - rate-limited batch processing
- `prisma/schema.prisma` - session, import history, and update result tables
