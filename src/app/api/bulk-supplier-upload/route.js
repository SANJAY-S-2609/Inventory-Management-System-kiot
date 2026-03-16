export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { connectDB } from "../../../lib/db";
import SupplierDetails from "../../../models/SupplierDetails";
import { randomUUID } from "crypto";

// export async function POST(request) {
//   try {
//     await connectDB();
//     const body = await request.json();

//     if (!Array.isArray(body) || body.length === 0) {
//       return NextResponse.json(
//         { message: "No data found to upload." },
//         { status: 400 },
//       );
//     }

//     const bulkData = body
//       .filter((row) => row.supplierName && row.gstin) // GSTIN is required in your schema
//       .map((row) => {
//         const clean = (val) => (val != null ? String(val).trim() : "");

//         // --- Phone Number Cleaning Logic ---
//         const cleanPhone = (val) => {
//           const num = clean(val).replace(/\D/g, ""); // Remove dashes/spaces
//           return num.length === 10 ? num : undefined; // Only keep if exactly 10
//         };

//         // --- GSTIN Cleaning Logic ---
//         const cleanGst = clean(row.gstin).toUpperCase().replace(/\s/g, "");

//         return {
//           supplierId: randomUUID(), // Keeping your existing unique ID logic
//           supplierName: clean(row.supplierName),
//           companyName: clean(row.companyName) || clean(row.supplierName),
//           gstin: cleanGst,
//           address: clean(row.address) || "N/A",
//           district: clean(row.district) || "N/A",
//           state: clean(row.state) || "N/A",
//           email: clean(row.email).toLowerCase() || undefined,
//           supplierMobileNumber: cleanPhone(row.supplierMobileNumber),
//           companyNumber: cleanPhone(row.companyNumber),
//           godownNumber: clean(row.godownNumber) || "",
//           Date: new Date(),
//         };
//       });

//     if (bulkData.length === 0) {
//       return NextResponse.json(
//         { message: "No valid rows found. Ensure Name and GSTIN are present." },
//         { status: 400 },
//       );
//     }

//     try {
//       // ordered: false allows skipping rows that fail (like duplicate GSTINs)
//       const result = await SupplierDetails.insertMany(bulkData, {
//         ordered: false,
//       });
//       return NextResponse.json(
//         { message: `Successfully added ${result.length} suppliers.` },
//         { status: 201 },
//       );
//     } catch (insertError) {
//       const insertedCount = insertError.insertedDocs
//         ? insertError.insertedDocs.length
//         : 0;
//       return NextResponse.json(
//         {
//           message: `Added ${insertedCount} new suppliers. Duplicate GSTINs/Numbers were skipped.`,
//         },
//         { status: 201 },
//       );
//     }
//   } catch (error) {
//     console.error("SYSTEM ERROR:", error);
//     return NextResponse.json(
//       { message: "Upload failed: " + error.message },
//       { status: 500 },
//     );
//   }
// }
export async function POST(request) {
  try {
    await connectDB();
    const body = await request.json();

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ message: "No data found." }, { status: 400 });
    }

    const bulkData = body
      .filter((row) => row.supplierName) // 👈 CHANGE: Only require Name, not GSTIN
      .map((row) => {
        const clean = (val) =>
          val != null && String(val).trim() !== ""
            ? String(val).trim()
            : undefined;

        const cleanPhone = (val) => {
          const num = String(val || "").replace(/\D/g, "");
          return num.length === 10 ? num : undefined;
        };

        return {
          supplierId: randomUUID(),
          supplierName: clean(row.supplierName),
          companyName: clean(row.companyName) || clean(row.supplierName),
          // 👈 Ensure GSTIN is undefined if empty to avoid duplicate "" errors
          gstin: clean(row.gstin) || clean(row["Gst Uin"]),
          address: clean(row.address) || "N/A",
          district: clean(row.district) || "N/A",
          state: clean(row.state) || "TAMILNADU",
          email: clean(row.email) ? String(row.email).toLowerCase() : undefined,
          supplierMobileNumber: cleanPhone(row.supplierMobileNumber),
          companyNumber: cleanPhone(row.companyNumber),
          godownNumber: clean(row.godownNumber),
          Date: new Date(),
        };
      });

    try {
      // ordered: false is CRITICAL. It tells Mongo:
      // "If one row fails (duplicate), don't stop, just keep going with the rest."
      const result = await SupplierDetails.insertMany(bulkData, {
        ordered: false,
      });

      return NextResponse.json(
        {
          message: `Success! Added ${result.length} suppliers.`,
        },
        { status: 201 },
      );
    } catch (insertError) {
      // If some failed due to duplicates, we still want to know how many were saved
      const insertedCount = insertError.insertedDocs
        ? insertError.insertedDocs.length
        : 0;

      // Log the specific reasons why the others failed in your terminal
      console.log(`Requested: ${bulkData.length}, Saved: ${insertedCount}`);

      return NextResponse.json(
        {
          message: `Added ${insertedCount} suppliers. ${bulkData.length - insertedCount} were skipped because they are already in the database.`,
        },
        { status: 201 },
      );
    }
  } catch (error) {
    console.error("SYSTEM ERROR:", error);
    return NextResponse.json(
      { message: "Upload failed: " + error.message },
      { status: 500 },
    );
  }
}
