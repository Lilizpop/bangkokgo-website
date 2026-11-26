
exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store"
  };

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const token = process.env.NOTION_TOKEN;
    const id = process.env.NOTION_PRODUCTS_ID;

    if (!token || !id) {
      throw new Error("Missing configuration");
    }

    const products = [];
    let cursor;

    do {
      const response = await fetch(
        `https://api.notion.com/v1/data_sources/${id}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Notion-Version": "2025-09-03",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            filter: {
              property: "Active",
              checkbox: { equals: true }
            },
            page_size: 100,
            ...(cursor ? { start_cursor: cursor } : {})
          })
        }
      );

      if (!response.ok) {
        console.error("Notion status:", response.status);
        throw new Error("Notion request failed");
      }

      const data = await response.json();

      for (const item of data.results) {
        const p = item.properties;
        const text = (key) =>
          (p[key]?.rich_text || [])
            .map(t => t.plain_text).join("");

        const name = (p["Product Name"]?.title || [])
          .map(t => t.plain_text).join("");

        if (!name) continue;

        products.push({
          id: item.id,
          name,
          chineseName: text("Chinese Name"),
          category: p["Category"]?.select?.name || "",
          price: p["Price"]?.number ?? null,
          salePrice: p["Sale Price"]?.number ?? null,
          stock: p["Stock"]?.number ?? 0,
          image: p["Product Image"]?.url || "",
          sku: text("SKU"),
          description: text("Description"),
          featured: p["Featured"]?.checkbox || false,
          newArrival: p["New Arrival"]?.checkbox || false,
          preorder: p["Pre-order"]?.checkbox || false,
          halalStatus: p["Halal Status"]?.select?.name || ""
        });
      }

      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(products)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Unable to load products"
      })
    };
  }
};
