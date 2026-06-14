import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const session = await prisma.session.findFirst({
    where: { id: "offline_techifyservices.myshopify.com" }
  });

  if (!session) {
    console.error("No session found!");
    return;
  }

  const graphqlUrl = `https://${session.shop}/admin/api/2024-04/graphql.json`;
  const query = `
    query IntrospectOutputTypes {
      minReqType: __type(name: "DiscountMinimumRequirement") {
        name
        kind
        possibleTypes {
          name
        }
      }
      minSubtotalType: __type(name: "DiscountMinimumSubtotal") {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
      discountItemsType: __type(name: "DiscountItems") {
        name
        fields {
          name
          type {
            name
            kind
            ofType {
              name
              kind
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch(graphqlUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": session.accessToken,
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();
    console.log("GraphQL Types Introspection:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Failed to introspect:", err);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
