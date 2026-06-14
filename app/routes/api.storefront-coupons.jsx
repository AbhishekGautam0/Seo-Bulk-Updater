import prisma from "../db.server";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return Response.json({ error: "Missing shop parameter" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const coupons = await prisma.coupon.findMany({
      where: {
        shop: shop,
        showOnStorefront: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({ coupons }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error("API storefront coupons error:", err);
    return Response.json({ error: err.message }, { status: 500, headers: CORS_HEADERS });
  }
};

export const action = async () => {
  return Response.json({}, { headers: CORS_HEADERS });
};
