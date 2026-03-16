import { NextResponse } from "next/server";
import { connectDB } from "../../../../lib/db";
import PurchaseHistory from "../../../../models/PurchaseHistory";
import Supplier from "../../../../models/SupplierDetails";
import ItemDetails from "../../../../models/ItemDetails";
import DistributedItems from "../../../../models/DistributedItems"; // Import the distribution model
export async function GET(req, { params }) {
  try {
    await connectDB();
    const { id } = await params;

    // 1. Find the main purchase record to get the Invoice Number
    const purchase = await PurchaseHistory.findById(id);
    if (!purchase) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }

    // 2. Find the supplier details
    const supplier = await Supplier.findOne({ supplierId: purchase.supplierId });

    // 3. CHANGE: Fetch items based on INVOICE NUMBER instead of itemIds array
    // This ensures we get every item detail that belongs to this specific bill
    const rawItems = await ItemDetails.find({ invoiceNumber: purchase.invoiceNumber });

    // 4. Process items and calculate distribution stats
    const itemsWithStats = await Promise.all(
      rawItems.map(async (item) => {
        // Find all distribution records for this specific Item ID
        const distributions = await DistributedItems.find({ itemId: item.itemId });
        
        const totalDistributed = distributions.reduce((sum, d) => sum + d.numberOfItems, 0);

        return {
          _id: item._id,
          itemId: item.itemId,
          name: item.name,
          unit: item.unit,
          perItemPrice : item.perItemPrice,
          purchasedQuantity: item.quantity, 
          totalDistributed: totalDistributed, 
          remainingStock: item.quantity - totalDistributed,
          originalPrice: item.originalPrice,
          discountPrice: item.discountPrice,
          finalPrice: item.totalAmount, 
          distributionDetails: distributions.map(d => ({
            place: d.distributedTo,
            count: d.numberOfItems,
            date: d.distributedDate
          }))        
        };
      })
    );

    return NextResponse.json({
      purchase,
      supplierName: supplier?.companyName || "Unknown Supplier",
      items: itemsWithStats
    }, { status: 200 });

  } catch (error) {
    console.error("Error fetching purchase details:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}


export async function PUT(req, { params }) {
  try {
    await connectDB();
    const { id } = await params; 
    const body = await req.json();
    const { invoiceNumber: newInvoice, supplierId: newSupplierId } = body;

    // 1. Find the OLD purchase record to get the OLD invoice number
    const oldPurchase = await PurchaseHistory.findById(id);
    if (!oldPurchase) {
      return NextResponse.json({ error: "Purchase record not found" }, { status: 404 });
    }
    const oldInvoice = oldPurchase.invoiceNumber;

    // 2. Fetch the NEW Supplier's actual details (Name and Phone)
    const supplierInfo = await Supplier.findOne({ supplierId: newSupplierId });
    if (!supplierInfo) {
      return NextResponse.json({ error: "Selected supplier not found" }, { status: 404 });
    }

    // 3. Update the PurchaseHistory record
    const updatedPurchase = await PurchaseHistory.findByIdAndUpdate(
      id,
      { 
        invoiceNumber: newInvoice, 
        supplierId: newSupplierId 
      },
      { new: true }
    );

    // 4. CASCADE UPDATE: Update all items in ItemDetails that belonged to the old invoice
    // We update: invoiceNumber, supplierId, companyName, and companyNumber
    await ItemDetails.updateMany(
      { invoiceNumber: oldInvoice }, // Match criteria
      { 
        $set: { 
          invoiceNumber: newInvoice,
          supplierId: newSupplierId,
          companyName: supplierInfo.companyName,
          companyNumber: supplierInfo.companyNumber || supplierInfo.phoneNumber || ""// Adjust based on your Supplier schema field name
        } 
      }
    );

    return NextResponse.json({
      message: "Purchase and all associated items updated successfully",
      updatedPurchase
    }, { status: 200 });

  } catch (error) {
    console.error("Update Error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}