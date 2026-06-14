const GET_PRODUCT_BY_HANDLE = `#graphql
  query GetProductByHandle($handle: String!) {
    productByIdentifier(identifier: { handle: $handle }) {
      id
      title
      handle
    }
  }
`;

const UPDATE_PRODUCT_SEO = `#graphql
  mutation UpdateProductSEO($productId: ID!, $seoTitle: String!, $seoDescription: String!) {
    productUpdate(product: {
      id: $productId
      seo: {
        title: $seoTitle
        description: $seoDescription
      }
    }) {
      product {
        id
        seo {
          title
          description
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_PRODUCT_CONTENT = `#graphql
  mutation UpdateProductContent(
    $productId: ID!
    $title: String!
    $descriptionHtml: String!
  ) {
    productUpdate(product: {
      id: $productId
      title: $title
      descriptionHtml: $descriptionHtml
    }) {
      product {
        id
        title
        handle
        descriptionHtml
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export async function getProductByHandle(admin, handle) {
  try {
    const response = await admin.graphql(GET_PRODUCT_BY_HANDLE, {
      variables: { handle },
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL error: ${data.errors[0].message}`);
    }

    const product = data.data.productByIdentifier;
    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  } catch (error) {
    throw new Error(`Failed to get product by handle: ${error.message}`);
  }
}

export async function updateProductSEO(admin, productId, metaTitle, metaDescription) {
  try {
    const response = await admin.graphql(UPDATE_PRODUCT_SEO, {
      variables: {
        productId,
        seoTitle: metaTitle,
        seoDescription: metaDescription,
      },
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL error: ${data.errors[0].message}`);
    }

    if (data.data?.productUpdate?.userErrors?.length > 0) {
      const errors = data.data.productUpdate.userErrors;
      throw new Error(`Shopify error: ${errors.map((e) => e.message).join(", ")}`);
    }

    return data.data.productUpdate.product;
  } catch (error) {
    throw new Error(`Failed to update product SEO: ${error.message}`);
  }
}

export async function updateProductContent(admin, productId, title, description) {
  try {
    const response = await admin.graphql(UPDATE_PRODUCT_CONTENT, {
      variables: {
        productId,
        title,
        descriptionHtml: description,
      },
    });

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL error: ${data.errors[0].message}`);
    }

    if (data.data?.productUpdate?.userErrors?.length > 0) {
      const errors = data.data.productUpdate.userErrors;
      throw new Error(`Shopify error: ${errors.map((e) => e.message).join(", ")}`);
    }

    return data.data.productUpdate.product;
  } catch (error) {
    throw new Error(`Failed to update product content: ${error.message}`);
  }
}
