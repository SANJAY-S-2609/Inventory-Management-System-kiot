import { NextResponse } from "next/server";
import { connectDB } from "../../../lib/db";
import ItemsMaster from "../../../models/Items";      // Master Table
import AddItems from "../../../models/ItemDetails";
import PurchaseHistory from "../../../models/PurchaseHistory";
import { randomUUID } from "crypto";


export async function POST(req) {
  try {
    await connectDB();
    const { invoiceNumber, supplier, items } = await req.json();

    let ids = [];
    let totalBefore = 0;
    let totalTax = 0;

    const sanitizedCompanyNumber = (supplier.companyNumber && String(supplier.companyNumber).length === 10) 
      ? supplier.companyNumber 
      : null;

    for (const item of items) {
      const id = item.existingItemId || randomUUID();

      const finalDate = item.purchaseDate || supplier.purchaseDate;
      const dateValue = item.purchaseDate || supplier.purchaseDate;

      await AddItems.create({
        ...item,
        itemId: id,
        invoiceNumber: invoiceNumber, 
        hsnSac: Number(item.hsnSac),
        supplierId: supplier.supplierId,
        companyName: supplier.companyName,
        companyNumber: sanitizedCompanyNumber,
        Date: dateValue ? new Date(dateValue) : new Date(), 

      });

      // 2. Sync to Master table ONLY IF it's a new item
      // $setOnInsert prevents overwriting existing master data
      await ItemsMaster.updateOne(
        { itemId: id }, 
        {
          $setOnInsert: {
            itemId: id,
            name: item.name,
            category: item.category,
            unit: item.unit,
            hsnSac: Number(item.hsnSac),
          },
        },
        { upsert: true } // Creates the document if it doesn't exist
      );

      ids.push(id);

      
      const amt = Number(item.totalAmount);
      const gst = Number(item.gstPercentage || 0);
      const before = amt / (1 + (gst / 100));
      totalBefore += before;
      totalTax += (amt - before);
    }

    await PurchaseHistory.create({
      invoiceNumber,
      supplierId: supplier.supplierId,
      itemIds: ids,
      gstPercent: 0,
      totalAmountBeforeTax: totalBefore.toFixed(2),
      totalTaxAmount: totalTax.toFixed(2),
      totalAmountAfterTax: (totalBefore + totalTax).toFixed(2),
      purchaseDate: supplier.purchaseDate ? new Date(supplier.purchaseDate) : new Date(),

    });

    return NextResponse.json({ message: "Saved" }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ message: err.message }, { status: 500 });
 
  }
}