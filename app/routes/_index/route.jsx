import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData();

  return (
    <div className="landing-bg">
      <div className="landing-card">
        <h1 className="landing-title">SEO & Content Bulk Updater</h1>
        <p className="landing-subtitle">
          {"Optimize and update your Shopify store's search engine listings, product titles, and HTML descriptions in bulk via CSV."}
        </p>

        {showForm && (
          <Form className="landing-form" method="post" action="/auth/login">
            <div className="landing-input-group">
              <label htmlFor="shop-domain" style={{ fontSize: "0.875rem", color: "#9ca3af", fontWeight: "500" }}>
                Shop Domain
              </label>
              <input
                id="shop-domain"
                className="landing-input"
                type="text"
                name="shop"
                placeholder="my-shop-domain.myshopify.com"
                required
              />
            </div>
            <button className="landing-button" type="submit">
              Log in to Shopify
            </button>
          </Form>
        )}

        <ul className="landing-list">
          <li className="landing-list-item">
            <span className="landing-list-icon">✦</span>
            <div>
              <strong>Instant SEO Optimization</strong>: Mass-update search engine meta titles and description tags for products in seconds.
            </div>
          </li>
          <li className="landing-list-item">
            <span className="landing-list-icon">✦</span>
            <div>
              <strong>Product Content Manager</strong>: Easily update standard product titles and HTML descriptions using simple CSV templates.
            </div>
          </li>
          <li className="landing-list-item">
            <span className="landing-list-icon">✦</span>
            <div>
              <strong>Import Auditing & Logs</strong>: Tracks full import histories, success/failure rates, and logs detailed error reports.
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
