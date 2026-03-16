import { NextResponse } from "next/server";
import mongoose from "mongoose";
import ItemDetails from "../../../models/ItemDetails";
import DistributedItems from "../../../models/DistributedItems";
import Items from "../../../models/Items"; // Make sure the path is correct

const connectDB = async () => {
  if (mongoose.connections[0].readyState) return;
  await mongoose.connect(process.env.MONGODB_URI);
};

export async function GET(request) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const viewType = searchParams.get("viewType") || "weekly";
    const productMaster = await Items.find({}); // <--- ADD THIS LINE

    // 1. Get all data (Newest items first)
    const allItems = await ItemDetails.find({}).sort({ createdAt: -1 });
    const allDistributions = await DistributedItems.find({});

    // 2. Map Total Distributions by Item Name
    const distMap = allDistributions.reduce((acc, d) => {
      const nameKey = d.itemName.toLowerCase().trim();
      acc[nameKey] = (acc[nameKey] || 0) + (Number(d.numberOfItems) || 0);
      return acc;
    }, {});

    // 3. Consolidate Items by Name
    const consolidatedMap = {};
    allItems.forEach((item) => {
      const nameKey = item.name.toLowerCase().trim();
      if (!consolidatedMap[nameKey]) {
        // This is the latest batch (because of the sort)
        consolidatedMap[nameKey] = {
          name: item.name,
          category: item.category,
          totalPurchased: 0,
          minOrderLevel: Number(item.minOrderLevel) || 0, // Latest threshold
        };
      }
      consolidatedMap[nameKey].totalPurchased += Number(item.quantity) || 0;
    });

    // 4. Calculate Final State
    const finalList = Object.values(consolidatedMap).map((item) => {
      const issued = distMap[item.name.toLowerCase().trim()] || 0;
      const remaining = item.totalPurchased - issued;
      return {
        ...item,
        remaining: remaining < 0 ? 0 : remaining,
      };
    });

    // 5. Filter Alerts
    const outOfStock = finalList
      .filter((i) => i.remaining <= 0)
      .map((i) => ({ name: i.name, category: i.category }));

    const lowStock = finalList
      .filter(
        (i) =>
          i.remaining > 0 &&
          i.minOrderLevel > 0 &&
          i.remaining <= i.minOrderLevel,
      )
      .map((i) => ({
        name: i.name,
        category: i.category,
        quantity: i.remaining,
        threshold: i.minOrderLevel,
      }));

    // 6. Analytics Logic (Simplified based on Distribution dates)
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    let analytics = [];

    if (viewType === "weekly") {
      analytics = days.map((day, idx) => {
        const count = allDistributions
          .filter((d) => new Date(d.distributedDate).getDay() === idx)
          .reduce((sum, d) => sum + (Number(d.numberOfItems) || 0), 0);
        return { label: day, stock: 100, dist: count };
      });
    } else {
      analytics = months.map((month, idx) => {
        const count = allDistributions
          .filter((d) => new Date(d.distributedDate).getMonth() === idx)
          .reduce((sum, d) => sum + (Number(d.numberOfItems) || 0), 0);
        return { label: month, stock: 200, dist: count };
      });
    }

    return NextResponse.json({
      stats: {
        totalProducts: productMaster.length, // This will show 47 (the actual database count)
        totalStock: finalList.reduce((acc, curr) => acc + curr.remaining, 0),
        categories: [...new Set(allItems.map((i) => i.category))].length,
      },
      alerts: { outOfStock, lowStock },
      analytics,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
