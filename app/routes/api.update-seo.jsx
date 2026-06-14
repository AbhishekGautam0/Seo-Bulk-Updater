import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { parseSEOCSV } from "../utils/csvParser.server.js";
import { extractHandleFromUrl, isValidProductUrl } from "../utils/urlUtils.server.js";
import {
  validateSEOTitle,
  validateSEODescription,
  validateURL,
} from "../utils/validators.server.js";
import { processBatchInChunks } from "../utils/batchProcessor.server.js";
import { getProductByHandle, updateProductSEO } from "../services/seoService.server.js";

const json = (body, init) => Response.json(body, init);

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const { admin, session } = await authenticate.admin(request);

    const formData = await request.formData();
    const file = formData.get("csvFile");

    if (!file) {
      return json({ error: "No file provided" }, { status: 400 });
    }

    const fileContent = await file.text();
    const filename = file.name;

    const parseResult = parseSEOCSV(fileContent);
    if (!parseResult.isValid) {
      return json({ error: parseResult.errors[0] }, { status: 400 });
    }

    const rows = parseResult.rows.map((row) => ({
      product_url: row.product_url.trim(),
      product_handle: row.product_handle.trim(),
      meta_title: row.meta_title.trim(),
      meta_description: row.meta_description.trim(),
    }));

    const validationErrors = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (row.product_url) {
        const urlValid = validateURL(row.product_url);
        if (!urlValid.isValid) {
          validationErrors.push(`Row ${i + 1}: Invalid URL format`);
          continue;
        }

        if (!isValidProductUrl(row.product_url)) {
          validationErrors.push(`Row ${i + 1}: Not a valid product URL`);
          continue;
        }
      }

      const titleValid = validateSEOTitle(row.meta_title);
      if (!titleValid.isValid) {
        validationErrors.push(`Row ${i + 1}: ${titleValid.message}`);
        continue;
      }

      const descValid = validateSEODescription(row.meta_description);
      if (!descValid.isValid) {
        validationErrors.push(`Row ${i + 1}: ${descValid.message}`);
      }
    }

    if (validationErrors.length > 0) {
      return json({ error: validationErrors[0] }, { status: 400 });
    }

    const { results } = await processBatchInChunks(
      rows,
      async (row) => {
        const result = {
          product_url: row.product_url,
          handle: row.product_handle,
          status: "failed",
          reason: null,
          metaTitle: row.meta_title,
          metaDescription: row.meta_description,
        };

        try {
          const handle = row.product_handle || extractHandleFromUrl(row.product_url);
          result.handle = handle;

          const product = await getProductByHandle(admin, handle);

          await updateProductSEO(
            admin,
            product.id,
            row.meta_title,
            row.meta_description
          );

          result.status = "success";
        } catch (error) {
          result.reason = error.message;
        }

        return result;
      },
      50
    );

    const successCount = results.filter((result) => result.status === "success").length;
    const failureCount = results.filter((result) => result.status === "failed").length;

    const importHistory = await prisma.sEOImportHistory.create({
      data: {
        shop: session.shop,
        filename,
        totalCount: results.length,
        successCount,
        failureCount,
        importData: results,
      },
    });

    for (const result of results) {
      await prisma.sEOUpdateResult.create({
        data: {
          importId: importHistory.id,
          productUrl: result.product_url || `/products/${result.handle}`,
          handle: result.handle,
          status: result.status,
          reason: result.reason,
          metaTitle: result.metaTitle,
          metaDescription: result.metaDescription,
        },
      });
    }

    return json({
      importId: importHistory.id,
      totalProcessed: results.length,
      successful: successCount,
      failed: failureCount,
      results,
    });
  } catch (error) {
    console.error("SEO update error:", error);
    return json(
      { error: `Failed to process SEO updates: ${error.message}` },
      { status: 500 }
    );
  }
};
