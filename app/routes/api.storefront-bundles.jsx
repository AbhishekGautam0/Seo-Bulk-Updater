import prisma from "../db.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const handle = url.searchParams.get("handle");

  if (!handle) {
    return Response.json(
      { error: "Missing product handle" },
      {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }

  try {
    const bundle = await prisma.productBundle.findFirst({
      where: { productHandle: handle },
      include: { items: true },
    });

    return Response.json(
      { bundle },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (err) {
    return Response.json(
      { error: err.message },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  }
};

export const action = async () => {
  return Response.json(
    {},
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    }
  );
};
