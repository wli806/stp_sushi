import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

// POST /api/sushi/goods-receiving
// body: { imageBase64: string, mediaType: string }
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const { imageBase64, mediaType } = await request.json();
    if (!imageBase64) return NextResponse.json({ error: "Image required" }, { status: 400 });

    // Step 1: Gemini Vision — extract invoice data
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mediaType ?? "image/jpeg",
          data: imageBase64,
        },
      },
      `Extract the following from this delivery invoice/packing slip and return ONLY valid JSON:
{
  "poNumber": "the supplier PO number or purchase order number (e.g. NKS-015-00111)",
  "supplierName": "supplier or vendor name",
  "deliveryDate": "delivery date in YYYY-MM-DD format if present, else null",
  "items": [
    {
      "code": "item/product code if present, else null",
      "name": "item name",
      "quantity": 0.0,
      "unit": "unit of measure (KG, EA, CTN, etc)"
    }
  ]
}
If a field is not found, use null. Return only the JSON object, no other text.`,
    ]);

    const rawText = result.response.text();
    let invoiceData: {
      poNumber: string | null;
      supplierName: string | null;
      deliveryDate: string | null;
      items: { code: string | null; name: string; quantity: number; unit: string }[];
    };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      invoiceData = jsonMatch ? JSON.parse(jsonMatch[0]) : { poNumber: null, supplierName: null, deliveryDate: null, items: [] };
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response", raw: rawText }, { status: 500 });
    }

    // Step 2: Match to DB order by PO number or supplier name
    let matchedOrder = null;
    if (invoiceData.poNumber) {
      const po = invoiceData.poNumber.trim();
      matchedOrder = await prisma.sushiOrder.findFirst({
        where: { poNumber: { contains: po } },
        include: { items: true },
        orderBy: { syncedAt: "desc" },
      });
    }
    if (!matchedOrder && invoiceData.supplierName) {
      matchedOrder = await prisma.sushiOrder.findFirst({
        where: { supplierName: { contains: invoiceData.supplierName } },
        include: { items: true },
        orderBy: { syncedAt: "desc" },
      });
    }

    return NextResponse.json({ invoice: invoiceData, order: matchedOrder });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
