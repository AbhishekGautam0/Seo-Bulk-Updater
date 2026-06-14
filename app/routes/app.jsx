import {
  Link,
  Outlet,
  useLoaderData,
  useLocation,
  useNavigate,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider as ShopifyAppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  AppProvider as PolarisAppProvider,
  Box,
  Card,
  Tabs,
} from "@shopify/polaris";
import enTranslations from "@shopify/polaris/locales/en.json";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData();
  // Fetch current routing location
  const location = useLocation();
  const navigate = useNavigate();

  const isSeoRoute = location.pathname === "/app" || location.pathname === "/app/seo-bulk-updater";

  const seoTabs = [
    { id: "dashboard", content: "Dashboard", path: "/app" },
    { id: "seo", content: "SEO bulk update", path: "/app/seo-bulk-updater" },
  ];

  const selectedTab = Math.max(
    0,
    seoTabs.findIndex((tab) => location.pathname === tab.path)
  );

  return (
    <ShopifyAppProvider embedded apiKey={apiKey}>
      <PolarisAppProvider i18n={enTranslations}>
        <NavMenu>
          <Link to="/app" rel="home">Dashboard</Link>
          <Link to="/app/product-bulk-update">Product content</Link>
          <Link to="/app/product-bundles">Product bundles</Link>
          <Link to="/app/coupons">Coupons</Link>
        </NavMenu>

        {isSeoRoute && (
          <Box paddingBlockStart="400" paddingInline="400">
            <Card padding="0">
              <Tabs
                tabs={seoTabs.map(({ id, content }) => ({ id, content }))}
                selected={selectedTab}
                onSelect={(index) => navigate(seoTabs[index].path)}
              />
            </Card>
          </Box>
        )}

        <Outlet />
      </PolarisAppProvider>
    </ShopifyAppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
