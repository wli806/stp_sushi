import { prisma } from "./prisma";

export async function applyOrderToInventory(orderId: string): Promise<void> {
  const order = await prisma.sushiOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: true },
  });

  if (order.inventoryApplied) throw new Error("该订单已同步过库存，不可重复操作");

  for (const item of order.items) {
    const name = item.itemName.trim();
    if (!name || item.quantity <= 0) continue;

    const existing = await prisma.sushiInventoryItem.findFirst({
      where: { name },
    });

    if (existing) {
      await prisma.sushiInventoryItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: item.quantity } },
      });
    } else {
      await prisma.sushiInventoryItem.create({
        data: { name, quantity: item.quantity, unit: item.uom || "" },
      });
    }
  }

  await prisma.sushiOrder.update({
    where: { id: orderId },
    data: { inventoryApplied: true },
  });
}
