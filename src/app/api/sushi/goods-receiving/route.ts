import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DASHSCOPE_URL =
  "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation";

// POST /api/sushi/goods-receiving
// body: { imageBase64: string, mediaType: string }
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const { imageBase64, mediaType } = await request.json();
    if (!imageBase64) return NextResponse.json({ error: "Image required" }, { status: 400 });

    const apiKey = process.env.DASHSCOPE_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "DASHSCOPE_API_KEY not configured" }, { status: 500 });

    // Step 1: Qwen-VL — extract invoice data
    const resp = await fetch(DASHSCOPE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen-vl-max",
        input: {
          messages: [
            {
              role: "user",
              content: [
                { image: `data:${mediaType ?? "image/jpeg"};base64,${imageBase64}` },
                {
                  text: `This is a supplier delivery invoice. Read the ITEMS TABLE carefully.

STEP 1: Scan the "ITEM No." column and write down every distinct item code you see (e.g. 2074200, 3739900). Each distinct code is one product row.

STEP 2: For each item code found in Step 1, extract:
- Its own description/name from the DESCRIPTION column on that same row only
- Cartons ordered (CARTONS ORDERED column)
- Cartons delivered (CARTONS DELIVERED column)
- Weight quantity (QUANTITY column, the numeric value)
- Unit (KG, CTN, EA, etc.)

CRITICAL RULES:
- If Step 1 found N distinct ITEM No. values, the "items" array MUST have exactly N objects
- Each object must have a DIFFERENT "code" value
- NEVER write two product names in the same "name" field
- One ITEM No. = One JSON object. Always.

Also extract from the invoice header:
- poNumber: the CUSTOMER'S order reference (look for CUST.ORDER, Your Order, PO No) — NOT the invoice number or customer account number
- supplierName: vendor company name
- deliveryDate: in YYYY-MM-DD format

Return ONLY this JSON, no explanation:
{
  "poNumber": "...",
  "invoiceNumber": "...",
  "supplierName": "...",
  "deliveryDate": "...",
  "items": [
    { "code": "2074200", "name": "FZ COOKED SCHNITZEL 1KGX4", "cartonsOrdered": 1, "cartonsDelivered": 1, "quantity": 0, "unit": "CTN" },
    { "code": "3739900", "name": "FZ ING CEN TENDERLOINS 12KGCTN", "cartonsOrdered": 1, "cartonsDelivered": 1, "quantity": 12, "unit": "KG" }
  ]
}`,
                },
              ],
            },
          ],
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json({ error: `AI API error (${resp.status}): ${errText}` }, { status: 500 });
    }

    const data = await resp.json();
    const rawText: string =
      data?.output?.choices?.[0]?.message?.content?.[0]?.text ?? "";

    let invoiceData: {
      poNumber: string | null;
      invoiceNumber: string | null;
      supplierName: string | null;
      deliveryDate: string | null;
      items: { code: string | null; name: string; cartonsOrdered: number; cartonsDelivered: number; quantity: number; unit: string }[];
    };
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      invoiceData = jsonMatch
        ? JSON.parse(jsonMatch[0])
        : { poNumber: null, supplierName: null, deliveryDate: null, items: [] };
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
