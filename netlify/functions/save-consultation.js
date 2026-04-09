const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const CONSULTATIONS_DB = "5a3e9a7991f7466fb6333d36b3e41a8c";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const data = JSON.parse(event.body);

    const today = new Date().toISOString().split("T")[0];
    const title = `${data.clientName || "Klien"} - ${data.productName || "Produk"} (${today})`;

    const properties = {
      "Judul Konsultasi": { title: [{ text: { content: title } }] },
      "Skor Kecocokan": { number: data.score || 0 },
      "Status Evaluasi": { select: { name: "Selesai" } },
      "Verdict": { select: { name: data.verdict || "Netral" } },
      "Ingredient Bermasalah": {
        rich_text: [{ text: { content: (data.warnings || "").substring(0, 2000) } }],
      },
      "Ingredient Kunci Positif": {
        rich_text: [{ text: { content: (data.positives || "").substring(0, 2000) } }],
      },
      "Interaksi Terdeteksi": {
        rich_text: [{ text: { content: (data.interactions || "").substring(0, 2000) } }],
      },
      "Catatan Lifestyle": {
        rich_text: [{ text: { content: (data.lifestyle || "").substring(0, 2000) } }],
      },
      "Rekomendasi": {
        rich_text: [{ text: { content: (data.recommendations || "").substring(0, 2000) } }],
      },
      "Hasil AI Analysis": {
        rich_text: [{ text: { content: (data.fullAnalysis || "").substring(0, 2000) } }],
      },
    };

    if (data.date) {
      properties["Tanggal Konsultasi"] = { date: { start: today } };
    }

    const response = await notion.pages.create({
      parent: { database_id: CONSULTATIONS_DB },
      properties,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, pageId: response.id }),
    };
  } catch (err) {
    console.error("Save failed:", err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ success: false, error: err.message }),
    };
  }
};
