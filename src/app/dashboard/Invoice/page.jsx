"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import "./invoice.css";

export default function AddPurchaseHistory() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [itemIds, setItemIds] = useState([]);

  const [formData, setFormData] = useState({
    invoiceNumber: "",
    supplierId: "",
    companyName: "",
    companyNumber: "",     // ✅ FIX
    cgstPercent: "",
    sgstPercent: "",
    cgst: "",
    sgst: "",
    totalBeforeTax: "",
  });

  const [loading, setLoading] = useState(false);

  /* ===============================
     PREFILL SUPPLIER + ITEMS
  =============================== */
  useEffect(() => {
    const supplierIdFromURL = searchParams.get("supplierId");
    const supplierNameFromURL = searchParams.get("companyName");
    const supplierNumberFromURL = searchParams.get("companyNumber");

    setFormData((prev) => ({
      ...prev,
      supplierId: supplierIdFromURL || "",
      companyName: supplierNameFromURL || "",
      companyNumber: supplierNumberFromURL || "",
    }));

    try {
      const stored = localStorage.getItem("purchase_item_ids");
      const parsed = stored ? JSON.parse(stored) : [];
      const cleaned = Array.isArray(parsed)
        ? parsed.filter((id) => typeof id === "string" && id.length > 0)
        : [];

      localStorage.setItem("purchase_item_ids", JSON.stringify(cleaned));
      setItemIds(cleaned);
    } catch {
      setItemIds([]);
    }
  }, [searchParams]);

  /* ===============================
     INPUT HANDLER
  =============================== */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  /* ===========================
     SUBMIT
  =============================== */
  const handleSubmit = async (e) => {
    e.preventDefault();

    // ✅ Safe validation
if (formData.companyNumber && formData.companyNumber.length > 0 && formData.companyNumber.length !== 10) {
  alert("Phone number must be exactly 10 digits (or leave it empty)");
  return;
}

    if (itemIds.length === 0) {
      alert("No items found for invoice");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/Invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          itemIds,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to create invoice");
        return;
      }

      localStorage.removeItem("purchase_item_ids");
      localStorage.removeItem("pending_supplier");

      alert("Invoice created successfully ✅");
      router.push("/dashboard/PurchaseHistory");
    } catch (err) {
      console.error(err);
      alert("Error saving invoice ❌");
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
    JSX (MUST RETURN)
  =============================== */
  return (
    <div className="purchase-container">
      <h2>Add Purchase Details</h2>

      <form onSubmit={handleSubmit} className="purchase-form">
        <input
          type="text"
          name="invoiceNumber"
          placeholder="Invoice Number"
          required
          value={formData.invoiceNumber}
          onChange={handleChange}
        />

        <input
          type="text"
          value={formData.companyName}
          readOnly
          placeholder="Supplier Name"
        />

        <input
          type="number"
          name="cgstPercent"
          placeholder="CGST %"
          value={formData.cgstPercent}
          onChange={handleChange}
        />

        <input
          type="number"
          name="sgstPercent"
          placeholder="SGST %"
          value={formData.sgstPercent}
          onChange={handleChange}
        />

        {/* <input
          type="number"
          name="cgst"
          placeholder="CGST Amount"
          value={formData.cgst}
          onChange={handleChange}
        />

        <input
          type="number"
          name="sgst"
          placeholder="SGST Amount"
          value={formData.sgst}
          onChange={handleChange}
        /> */}

        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Save Purchase"}
        </button>
      </form>
    </div>
  );
}
