import { GoogleGenerativeAI } from "@google/generative-ai";

let client = null;
function getClient() {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!client) client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client;
}

const PROMPT = `You are a food-safety assistant for a food donation app. Given the donation details below, respond with ONLY a compact JSON object (no markdown fences) with these exact keys:
{
  "category": string,            // one short cuisine/food category, e.g. "Rice dish", "Bakery", "Curry"
  "allergens": string[],         // common allergens likely present, e.g. ["dairy","gluten","nuts"], [] if none obvious
  "shelfLifeNote": string,       // one short sentence on how long this is safe to eat and any storage advice
  "generatedDescription": string, // one friendly sentence describing the donation for the listing, plain text
  "estimatedServings": number    // best-guess number of servings based on quantity/unit given
}

Donation details:
Title: {{title}}
Description: {{description}}
Food type: {{foodType}}
Quantity: {{quantity}} {{unit}}
Prepared at: {{preparedAt}}`;

function buildPrompt(donation) {
  return PROMPT.replace("{{title}}", donation.title || "")
    .replace("{{description}}", donation.description || "(none provided)")
    .replace("{{foodType}}", donation.foodType || "")
    .replace("{{quantity}}", donation.quantity || "")
    .replace("{{unit}}", donation.unit || "")
    .replace("{{preparedAt}}", donation.preparedAt || new Date().toISOString());
}

function parseJsonResponse(text) {
  const cleaned = text.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

/**
 * Enriches a donation with AI-generated tags (category, allergens, shelf-life note,
 * friendly description, estimated servings). Returns null if no API key is configured
 * or the call fails - callers must treat AI enrichment as optional, never blocking.
 */
export async function enrichDonation(donation, photoFile) {
  const genAI = getClient();
  if (!genAI) return null;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const parts = [{ text: buildPrompt(donation) }];

    if (photoFile?.buffer) {
      parts.push({
        inlineData: { data: photoFile.buffer.toString("base64"), mimeType: photoFile.mimetype },
      });
    }

    const result = await model.generateContent(parts);
    const text = result.response.text();
    const parsed = parseJsonResponse(text);

    return {
      category: parsed.category || undefined,
      allergens: Array.isArray(parsed.allergens) ? parsed.allergens : [],
      shelfLifeNote: parsed.shelfLifeNote || undefined,
      generatedDescription: parsed.generatedDescription || undefined,
      estimatedServings: Number(parsed.estimatedServings) || undefined,
    };
  } catch (err) {
    console.error("Gemini enrichment failed, continuing without AI tags:", err.message);
    return null;
  }
}
