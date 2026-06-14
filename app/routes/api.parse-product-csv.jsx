import { authenticate } from "../shopify.server";
import { parseProductUpdateCSV } from "../utils/csvParser.server.js";

const json = (body, init) => Response.json(body, init);

export const action = async ({ request }) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    await authenticate.admin(request);

    const formData = await request.formData();
    const file = formData.get("csvFile");

    if (!file) {
      return json({ error: "No file provided" }, { status: 400 });
    }

    const fileContent = await file.text();
    const parseResult = parseProductUpdateCSV(fileContent);

    if (!parseResult.isValid) {
      return json({ error: parseResult.errors[0] }, { status: 400 });
    }

    return json({
      rows: parseResult.rows,
    });
  } catch (error) {
    console.error("Product CSV parse error:", error);
    return json(
      { error: `Failed to parse CSV: ${error.message}` },
      { status: 500 }
    );
  }
};
