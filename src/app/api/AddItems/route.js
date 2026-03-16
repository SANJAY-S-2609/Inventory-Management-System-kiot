
export const runtime = "nodejs";

import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import AddItems from "../../../models/ItemDetails";
import ProductMaster from "../../../models/ProductMaster";
import { connectDB } from "../../../lib/db";
import PurchaseHistory from "../../../models/PurchaseHistory";

/* =========================
   POST : ADD ITEM
   ========================= */
export async function POST(request) {
  try {
    const body = await request.json();

    console.log("ADD ITEM BODY 👉", body);
    const {
      supplierId,
      name,
      quantity,
      unit,
      perItemPrice,
      originalPrice,
      discountPercentage,
      discountPrice,
      companyName,
      companyNumber,
      hsnSac,
      category,
      minOrderLevel,
      gstPercentage,
      purchaseDate, // 👈 Extracted from frontend body
    } = body;

    // Validation
    if (!name || !quantity || !unit || !perItemPrice) {
      return NextResponse.json(
        {
          message:
            "Required fields missing (Name, Qty, Unit, or Price per item)",
        },
        { status: 400 },
      );
    }

    const qty = Number(quantity);
    const pip = Number(perItemPrice);

    const op = qty * pip;
    const dp = Number(discountPrice || 0);
    const dperc = Number(discountPercentage || 0);

    let finalDiscountPrice = dp;
    let finalDiscountPercentage = dperc;

    if (finalDiscountPercentage > 0 && finalDiscountPrice === 0) {
      finalDiscountPrice = (op * finalDiscountPercentage) / 100;
    }

    if (finalDiscountPrice > 0 && finalDiscountPercentage === 0) {
      finalDiscountPercentage = (finalDiscountPrice / op) * 100;
    }

    const totalAmount = op - finalDiscountPrice;

    if (totalAmount < 0) {
      return NextResponse.json(
        { message: "Invalid discount values" },
        { status: 400 },
      );
    }

    const itemId = randomUUID();

    const itemData = {
      itemId,
      supplierId,
      name,
      quantity: Number(quantity),
      unit,
      perItemPrice: Number(pip),
      originalPrice: Number(op.toFixed(2)),
      discountPercentage: Number(finalDiscountPercentage.toFixed(2)),
      discountPrice: Number(finalDiscountPrice.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
      companyName,
      companyNumber,
      hsnSac: Number(hsnSac),
      category,
      minOrderLevel: Number(minOrderLevel),
      gstPercentage: Number(gstPercentage),
      // 👈 Map frontend 'purchaseDate' to Schema 'Date'
      Date: purchaseDate ? new Date(purchaseDate) : new Date(),
    };

    console.log("Saving Item with Date:", itemData.Date);

    await connectDB();
    await AddItems.create(itemData);

    return NextResponse.json(
      { message: "Item added successfully", data: itemData },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST Error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 },
    );
  }
}

/* =========================
   GET : ALL ITEMS / SINGLE ITEM
   ========================= */
export async function GET(request) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const itemId = searchParams.get("itemId");
    const searchHsn = searchParams.get("searchHsn");
    const searchName = searchParams.get("searchName");
    const getLatestHistory = searchParams.get("getLatestHistory");

    // 1. Get Latest History for an item (pre-filling details)
    if (getLatestHistory) {
      const latestEntry = await AddItems.findOne({ itemId: getLatestHistory })
        .sort({ Date: -1 })
        .lean();
      return NextResponse.json(latestEntry || {});
    }

    // 2. Get Single Item for Editing
    if (itemId) {
      const item = await AddItems.findById(itemId).lean();
      if (item) {
        // 👈 Map DB 'Date' back to 'purchaseDate' so the frontend form displays it correctly
        item.purchaseDate = item.Date;
      }
      return NextResponse.json(item, { status: 200 });
    }

    // 3. Search Suggestions (HSN or Name)
    if (searchHsn || searchName) {
      let masterQuery = {};
      if (searchHsn) masterQuery.hsnSac = { $regex: searchHsn, $options: "i" };
      if (searchName) masterQuery.name = { $regex: searchName, $options: "i" };

      let historyQuery = {};
      if (searchName) historyQuery.name = { $regex: searchName, $options: "i" };
      if (searchHsn) {
        historyQuery = {
          $expr: {
            $regexMatch: {
              input: { $toString: "$hsnSac" },
              regex: searchHsn,
              options: "i",
            },
          },
        };
      }

      const [masterResults, historyResults] = await Promise.all([
        ProductMaster.find(masterQuery).limit(10).lean(),
        AddItems.find(historyQuery).limit(10).lean(),
      ]);

      const combinedResults = [...historyResults, ...masterResults];
      const uniqueResults = [];
      const seenNames = new Set();

      for (const item of combinedResults) {
        const normalizedName = item.name.trim().toLowerCase();
        if (item.hsnSac) item.hsnSac = String(item.hsnSac);

        if (!seenNames.has(normalizedName)) {
          seenNames.add(normalizedName);
          uniqueResults.push(item);
        }
      }

      return NextResponse.json(uniqueResults.slice(0, 15), { status: 200 });
    }

    // 4. Default: Fetch All Items
    const items = await AddItems.find().sort({ createdAt: -1 });
    return NextResponse.json(items, { status: 200 });
  } catch (error) {
    console.error("GET Error", error);
    return NextResponse.json(
      { message: "Failed to fetch items" },
      { status: 500 },
    );
  }
}

/* =========================
   PUT : UPDATE ITEM
   ========================= */
export async function PUT(request) {
  try {
    await connectDB();
    const body = await request.json();

    const { recordId, ...updateData } = body;

    if (!recordId) {
      return NextResponse.json(
        { message: "Record ID is required" },
        { status: 400 },
      );
    }

    const qty = Number(updateData.quantity);
    const pip = Number(updateData.perItemPrice);

    const op = qty * pip;
    const dperc = Number(updateData.discountPercentage || 0);
    const finalDiscountPrice = (op * dperc) / 100;
    const totalAmount = op - finalDiscountPrice;

    // Prepare cleaned data
    const cleanedData = {
      ...updateData,
      quantity: Number(updateData.quantity),
      perItemPrice: pip,
      gstPercentage: Number(updateData.gstPercentage), // 👈 Explicitly ensure GST is updated
      originalPrice: Number(op.toFixed(2)),
      discountPercentage: dperc,
      discountPrice: Number(finalDiscountPrice.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
      hsnSac: Number(updateData.hsnSac),
      companyName: updateData.companyName?.trim(),
      companyNumber: updateData.companyNumber?.trim(),
      // 👈 Update the Date if purchaseDate is provided in the PUT request
      Date: updateData.purchaseDate
        ? new Date(updateData.purchaseDate)
        : undefined,
    };

    const updatedItem = await AddItems.findByIdAndUpdate(
      recordId,
      { $set: cleanedData },
      { new: true, runValidators: true },
    );

    if (!updatedItem) {
      return NextResponse.json({ message: "Item not found" }, { status: 404 });
    }

    /* ------------------------------------------------------------------
       RECALCULATE INVOICES (Purchase History Sync)
     ------------------------------------------------------------------ */
    const customUuid = updatedItem.itemId;
    const relatedInvoices = await PurchaseHistory.find({ itemIds: customUuid });

    for (const invoice of relatedInvoices) {
      const allItemsInThisInvoice = await AddItems.find({
        itemId: { $in: invoice.itemIds },
      });

      const newInvoiceTotalBeforeTax = allItemsInThisInvoice.reduce(
        (sum, item) => sum + Number(item.totalAmount),
        0,
      );

      const newCgst =
        (newInvoiceTotalBeforeTax * (invoice.cgstPercent || 0)) / 100;
      const newSgst =
        (newInvoiceTotalBeforeTax * (invoice.sgstPercent || 0)) / 100;
      const newTotalTax = newCgst + newSgst;
      const newTotalAfterTax = newInvoiceTotalBeforeTax + newTotalTax;

      await PurchaseHistory.updateOne(
        { _id: invoice._id },
        {
          $set: {
            totalAmountBeforeTax: Number(newInvoiceTotalBeforeTax.toFixed(2)),
            cgst: Number(newCgst.toFixed(2)),
            sgst: Number(newSgst.toFixed(2)),
            totalTaxAmount: Number(newTotalTax.toFixed(2)),
            totalAmountAfterTax: Number(newTotalAfterTax.toFixed(2)),
          },
        },
      );
    }

    return NextResponse.json(
      { message: "Item updated successfully", data: updatedItem },
      { status: 200 },
    );
  } catch (error) {
    console.error("PUT ERROR:", error);
    return NextResponse.json(
      { message: error.message || "Failed to update item" },
      { status: 500 },
    );
  }
}
//hiiiiii