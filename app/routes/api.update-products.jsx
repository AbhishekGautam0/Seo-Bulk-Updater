import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { parseProductUpdateCSV } from "../utils/csvParser.server.js";
import { extractHandleFromUrl, isValidProductUrl } from "../utils/urlUtils.server.js";
import { validateURL } from "../utils/validators.server.js";
import { processBatchInChunks } from "../utils/batchProcessor.server.js";
import {
  getProductByHandle,
  updateProductContent,
} from "../services/seoService.server.js";

const json = (body, init) => Response.json(body, init);
const MAX_TITLE_LENGTH = 255;

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
    const parseResult = parseProductUpdateCSV(fileContent);

    if (!parseResult.isValid) {
      return json({ error: parseResult.errors[0] }, { status: 400 });
    }

    const rows = parseResult.rows.map((row) => ({
      product_handle: row.product_handle.trim(),
      product_url: row.product_url.trim(),
      title: row.title.trim(),
      description: row.description.trim(),
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

      if (row.title.length > MAX_TITLE_LENGTH) {
        validationErrors.push(
          `Row ${i + 1}: Title exceeds ${MAX_TITLE_LENGTH} characters`
        );
        continue;
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
          title: row.title,
          description: row.description,
        };

        try {
          const handle = row.product_handle || extractHandleFromUrl(row.product_url);
          result.handle = handle;

          const product = await getProductByHandle(admin, handle);
          await updateProductContent(admin, product.id, row.title, row.description);

          result.status = "success";
        } catch (error) {
          result.reason = error.message;
        }

        return result;
      },
      25
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
          metaTitle: result.title,
          metaDescription: result.description,
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
    console.error("Product update error:", error);
    return json(
      { error: `Failed to process product updates: ${error.message}` },
      { status: 500 }
    );
  }
};
