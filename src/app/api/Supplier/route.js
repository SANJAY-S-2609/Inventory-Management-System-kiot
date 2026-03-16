import { NextResponse } from "next/server";
import SupplierDetails from "../../../models/SupplierDetails";
import { connectDB } from "../../../lib/db";
import { randomUUID } from "crypto"; // ✅ use UUID


export async function GET(req) {
  try {
    await connectDB();
    

    const { searchParams } = new URL(req.url);
    const supplierId = searchParams.get("supplierId");

    if (supplierId) {
      const supplier = await SupplierDetails.findOne({ supplierId });
      return NextResponse.json(supplier, { status: 200 });
    }

    const suppliers = await SupplierDetails.find().sort({ createdAt: -1 });
    return NextResponse.json(suppliers, { status: 200 });
  } catch (error) {
    console.error("GET /api/Supplier error:", error);
    return NextResponse.json(
      { message: "Failed to fetch suppliers" },
      { status: 500 }
    );
  }
}


export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json();

    const {
      supplierName,
      companyName,
      gstin,
      address,
      district,
      state,
      supplierMobileNumber,
      companyNumber,
      godownNumber,
      email,
    } = body;
        const sanitizedNumber = (companyNumber && companyNumber.trim().length === 10) 
      ? companyNumber.trim() 
      : undefined;

    // Required fields validation
    if (  !companyName || !gstin) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }

    // ✅ Generate supplierId using UUID
    const supplierId = randomUUID();

    const newSupplier = await SupplierDetails.create({
      supplierId,               // Auto-generated
      supplierName,
      companyName,
      gstin,
      address,
      district,
      state,
      supplierMobileNumber,
      companyNumber: sanitizedNumber,
      godownNumber: godownNumber || "",
      email,
    });

    return NextResponse.json(
      { message: "Supplier stored successfully", supplier: newSupplier },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/AddSuppliers error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    await connectDB();
    const body = await req.json();
    const { supplierId, ...updateData } = body;

    if (!supplierId) {
      return NextResponse.json(
        { message: "Supplier ID is required" },
        { status: 400 }
      );
    }

    const updatedSupplier = await SupplierDetails.findOneAndUpdate(
      { supplierId },
      updateData,
      { new: true }
    );

    if (!updatedSupplier) {
      return NextResponse.json(
        { message: "Supplier not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "Supplier updated successfully", supplier: updatedSupplier },
      { status: 200 }
    );
  } catch (error) {
    console.error("PUT /api/Supplier error:", error);
    return NextResponse.json(
      { message: "Internal Server Error" },
      { status: 500 }
    );
  }
}