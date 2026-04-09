const { Client } = require("@notionhq/client");
const fs = require("fs");
const path = require("path");

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID || "1e68d0d769724eecbf881f8a8ad98c54";

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function getTextProp(page, propName) {
  const prop = page.properties[propName];
  if (!prop) return "";
  if (prop.type === "title") return prop.title.map((t) => t.plain_text).join("");
  if (prop.type === "rich_text") return prop.rich_text.map((t) => t.plain_text).join("");
  return "";
}

function getSelectProp(page, propName) {
  const prop = page.properties[propName];
  if (!prop || prop.type !== "select" || !prop.select) return "";
  return prop.select.name;
}

function getMultiSelectProp(page, propName) {
  const prop = page.properties[propName];
  if (!prop || prop.type !== "multi_select") return [];
  return prop.multi_select.map((s) => s.name);
}

function getNumberProp(page, propName) {
  const prop = page.properties[propName];
  if (!prop || prop.type !== "number" || prop.number === null) return null;
  return prop.number;
}

function getCheckboxProp(page, propName) {
  const prop = page.properties[propName];
  if (!prop || prop.type !== "checkbox") return false;
  return prop.checkbox;
}

function getUrlProp(page, propName) {
  const prop = page.properties[propName];
  if (!prop || prop.type !== "url") return "";
  return prop.url || "";
}

// Derive display tags from Function field
function deriveTags(functionStr, cocokUntuk) {
  const tags = new Set();
  const fn = (functionStr || "").toLowerCase();

  if (fn.includes("antioxidant")) tags.add("Antioksidan");
  if (fn.includes("soothing") || fn.includes("anti-inflammatory")) tags.add("Soothing");
  if (fn.includes("moisturizer") || fn.includes("humectant")) tags.add("Hydration");
  if (fn.includes("exfoliant") || fn.includes("keratolytic")) tags.add("Exfoliant");
  if (fn.includes("brightening") || fn.includes("tyrosinase")) tags.add("Brightening");
  if (fn.includes("anti-aging") || fn.includes("collagen") || fn.includes("cell-communicating")) tags.add("Anti-Aging");
  if (fn.includes("sunscreen") || fn.includes("uv filter") || fn.includes("photoprotection")) tags.add("Sunscreen");
  if (fn.includes("emollient")) tags.add("Emolien");
  if (fn.includes("antibacterial") || fn.includes("anti-acne") || fn.includes("antimicrobial")) tags.add("Anti-Acne");
  if (fn.includes("preservative")) tags.add("Preservative");
  if (fn.includes("barrier") || fn.includes("skin-identical")) tags.add("Barrier Repair");
  if (fn.includes("peptide") || fn.includes("cell-communicating ingredient")) tags.add("Peptida");

  // Also add from Cocok Untuk
  cocokUntuk.forEach((c) => {
    if (c === "Acne") tags.add("Anti-Acne");
    if (c === "Aging") tags.add("Anti-Aging");
    if (c === "Hiperpigmentasi") tags.add("Brightening");
    if (c === "Dehidrasi") tags.add("Hydration");
    if (c === "Barrier Rusak") tags.add("Barrier Repair");
  });

  return Array.from(tags);
}

// Map evidence level to display format
function mapEvidence(level) {
  const map = {
    Strong: { level: "high", label: "Clinical Trial" },
    Moderate: { level: "mid", label: "In-Vitro Study" },
    Weak: { level: "low", label: "Limited Evidence" },
    Anecdotal: { level: "low", label: "Anecdotal" },
  };
  return map[level] || { level: "mid", label: level || "Data Pending" };
}

// Map category to color for detail page
function categoryColor(cat) {
  const map = {
    Superstar: "#9CAEF0",
    Goodie: "#10B981",
    Regular: "#6B7280",
  };
  return map[cat] || "#6B7280";
}

async function fetchAllIngredients() {
  const pages = [];
  let cursor;

  do {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return pages;
}

async function main() {
  console.log("Fetching ingredients from Notion...");

  const pages = await fetchAllIngredients();
  console.log(`Found ${pages.length} ingredients`);

  const ingredients = pages
    .map((page) => {
      const name = getTextProp(page, "Ingredient Name");
      if (!name) return null;

      const category = getSelectProp(page, "Category");
      const functionStr = getTextProp(page, "Function");
      const cocokUntuk = getMultiSelectProp(page, "Cocok Untuk");
      const evidenceLevel = getSelectProp(page, "Evidence Level");
      const evidence = mapEvidence(evidenceLevel);

      return {
        slug: slugify(name),
        name,
        category,
        categoryColor: categoryColor(category),
        function: functionStr,
        description: getTextProp(page, "Description"),
        evidence: evidence.level,
        evidenceLabel: evidence.label,
        safetyScore: getNumberProp(page, "Safety Score"),
        irritancy: getNumberProp(page, "Irritancy"),
        comedogenicity: getNumberProp(page, "Comedogenicity"),
        cocokUntuk,
        hindariJika: getMultiSelectProp(page, "Hindari Jika"),
        idealConcentration: getTextProp(page, "Ideal Concentration"),
        phRange: getTextProp(page, "pH Range"),
        interaksi: getTextProp(page, "Interaksi"),
        photosensitivity: getCheckboxProp(page, "Photosensitivity"),
        inciDecoderUrl: getUrlProp(page, "INCIDecoder URL"),
        sumberRiset: getUrlProp(page, "Sumber Riset"),
        tags: deriveTags(functionStr, cocokUntuk),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      // Sort: Superstar first, then Goodie, then Regular
      const order = { Superstar: 0, Goodie: 1, Regular: 2 };
      const diff = (order[a.category] ?? 3) - (order[b.category] ?? 3);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });

  // Ensure data directory exists
  const dataDir = path.join(__dirname, "..", "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const outPath = path.join(dataDir, "ingredients.json");
  fs.writeFileSync(outPath, JSON.stringify(ingredients, null, 2));
  console.log(`Wrote ${ingredients.length} ingredients to ${outPath}`);
}

main().catch((err) => {
  console.error("Build failed:", err.message);
  process.exit(1);
});
