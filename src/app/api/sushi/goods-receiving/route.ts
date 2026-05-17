import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/sushi/goods-receiving
// body: { imageBase64: string, mediaType: string }
// Returns: extracted invoice data + matched DB order
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const { imageBase64, mediaType } = await request.json();
    if (!imageBase64) return NextResponse.json({ error: "Image required" }, { status: 400 });

    // Step 1: Claude Vision — extract invoice data
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType ?? "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: `Extract the following from this delivery invoice/packing slip and return ONLY valid JSON:
{
  "poNumber": "the supplier PO number or purchase order number (e.g. NKS-015-00111)",
  "supplierName": "supplier or vendor name",
  "deliveryDate": "delivery date in YYYY-MM-DD format if present, else null",
  "items": [
    {
      "code": "item/product code if present",
      "name": "item name",
      "quantity": 0.0,
      "unit": "unit of measure (KG, EA, CTN, etc)"
    }
  ]
}
If a field is not found, use null. Return only the JSON object, no other text.`,
            },
          ],
        },
      ],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
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

    // Step 2: Match to DB order by PO number
    let matchedOrder = null;
    if (invoiceData.poNumber) {
      const po = invoiceData.poNumber.trim();
      matchedOrder = await prisma.sushiOrder.findFirst({
        where: {
          OR: [
            { poNumber: { contains: po } },
            { supplierName: { contains: invoiceData.supplierName ?? "" } },
          ],
        },
        include: { items: true },
        orderBy: { syncedAt: "desc" },
      });
      // Fallback: search by supplier name alone
      if (!matchedOrder && invoiceData.supplierName) {
        matchedOrder = await prisma.sushiOrder.findFirst({
          where: { supplierName: { contains: invoiceData.supplierName } },
          include: { items: true },
          orderBy: { syncedAt: "desc" },
        });
      }
    }

    return NextResponse.json({ invoice: invoiceData, order: matchedOrder });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
