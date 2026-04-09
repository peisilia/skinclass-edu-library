exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const webhookSecret = process.env.WEBHOOK_SECRET;
  if (webhookSecret) {
    const provided = event.headers["x-webhook-secret"] || event.headers["X-Webhook-Secret"];
    if (provided !== webhookSecret) {
      return { statusCode: 401, body: "Unauthorized" };
    }
  }

  const buildHookUrl = process.env.NETLIFY_BUILD_HOOK_URL;
  if (!buildHookUrl) {
    return { statusCode: 500, body: "Build hook URL not configured" };
  }

  try {
    const response = await fetch(buildHookUrl, { method: "POST" });
    if (response.ok) {
      return { statusCode: 200, body: JSON.stringify({ message: "Build triggered" }) };
    }
    return { statusCode: 502, body: "Failed to trigger build" };
  } catch (err) {
    return { statusCode: 500, body: "Error: " + err.message };
  }
};
