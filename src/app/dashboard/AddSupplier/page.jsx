"use client";

import React, { useState } from "react";
import "./addSupplier.css";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import * as XLSX from "xlsx";

function AddSupplier() {
  const searchParams = useSearchParams();
  const supplierId = searchParams.get("supplierId");
  const isEditMode = Boolean(supplierId);

  const router = useRouter(); // ✅ useRouter hook
  const [form, setForm] = useState({
    supplierName: "",
    companyName: "",
    gstin: "", 
    address: "",
    district: "",
    state: "",
    supplierMobileNumber: "",
    companyNumber: "",
    godownNumber: "",
    email: "",
  });

  const [loading, setLoading] = useState(false);

  // --- EXCEL UPLOAD HANDLERS ---
const handleExcelUpload = (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    const bstr = evt.target.result;
    const wb = XLSX.read(bstr, { type: "binary" });
    const wsname = wb.SheetNames[0];
    const ws = wb.Sheets[wsname];
    
    // 1. Get raw data from Excel
    const rawData = XLSX.utils.sheet_to_json(ws);

    // 2. Map data based on your specific Excel structure (mapping Col A and Col D)
// Inside handleExcelUpload function
const mappedData = rawData.map((item) => ({
  // We use the exact headers from your Excel image
  supplierName: item.supplierName || "", 
  companyName: item.supplierName || "", // Mapping same name to companyName
  gstin: item["Gst Uin"] || item.gstin || "", 
  email: item.email || "",
  supplierMobileNumber: item.supplierMobileNumber || "",
  companyNumber: item.companyNumber || "",
  address: item.address || "",
  district: item.district || "",
  state: item.state || "",
  godownNumber: item.godownNumber || "",
}));
    const rawDat = XLSX.utils.sheet_to_json(ws);
    console.log("EXCEL RAW DATA PREVIEW:", rawDat[0]); // Check your browser console (F12) for this!

    uploadSuppliers(mappedData);
  };
  reader.readAsBinaryString(file);
};

  const uploadSuppliers = async (data) => {
    try {
      setLoading(true);
      const res = await fetch("/api/bulk-supplier-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        alert("✅ Supplier List Uploaded Successfully!");
        router.push("/dashboard/Supplier");
      } else {
        const errData = await res.json();
        alert(`❌ Error: ${errData.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to server.");
    } finally {
      setLoading(false);
    }
  };
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form,[name]: name === "gstin" ? value.toUpperCase() : value 
});
  };

  useEffect(() => {
    if (!supplierId) return;

    const fetchSupplier = async () => {
      try {
        const res = await fetch(`/api/Supplier?supplierId=${supplierId}`);
        const data = await res.json();

        setForm({
          supplierName: data.supplierName || "",
          companyName: data.companyName || "",
          gstin: data.gstin || "", // <--- ADD THIS

          address: data.address || "",
          district: data.district || "",
          state: data.state || "",
          supplierMobileNumber: data.supplierMobileNumber || "",
          companyNumber: data.companyNumber || "",
          godownNumber: data.godownNumber || "",
          email: data.email || "",
        });
      } catch (error) {
        alert("Failed to load supplier data");
      }
    };

    fetchSupplier();
  }, [supplierId]);

const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);

  try {
    const response = await fetch("/api/Supplier", {
      method: isEditMode ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isEditMode ? { ...form, supplierId } : form),
    });

    // 1. READ THE JSON ONLY ONCE HERE
    const result = await response.json();

    if (response.ok) {
      const fromPage = searchParams.get("from");

      // Check if we came from the Add Item page
      if (fromPage === "addItem") {
        alert("Supplier Saved! Returning to your item entry...");
        
        // 2. Use the 'result' variable we already defined above
        // Make sure to use optional chaining (?.) to prevent crashes
        const newId = result.supplier?.supplierId;

        if (newId) {
          router.push(`/dashboard/Additem?newSupplierId=${newId}`);
        } else {
          alert("Error: Supplier ID was not returned from server.");
          router.push("/dashboard/Additem");
        }
      } else {
        // Normal redirection for standard supplier addition
        alert(isEditMode ? "Supplier Updated!" : "Supplier Saved!");
        router.push("/dashboard/Supplier");
      }
    } else {
      // 3. Use the 'result' variable for the error message
      alert(`Error: ${result.message || "Failed to save supplier"}`);
    }
  } catch (error) {
    console.error("Submit error:", error);
    alert("Failed to connect to the server.");
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="add-supplier-wrapper">
      <div className="form-container-full shadow-lg">
        <div className="form-header-row">
          <button className="back-nav-btn" onClick={() => router.back()}>
            ← Back
          </button>
          <div className="header-text">
            <h2>
              {isEditMode ? "Edit Supplier" : "New Supplier Registration"}
            </h2>
          </div>
           {/* ADD THIS SECTION BELOW */}
          {!isEditMode && (
            <div className="excel-upload-container">
              <input
                type="file"
                id="supplierExcel"
                hidden
                accept=".xlsx, .xls"
                onChange={handleExcelUpload}
              />
              <label
                htmlFor="supplierExcel"
                className="btn btn-success btn-sm fw-bold shadow-sm"
                style={{ cursor: "pointer", padding: "8px 15px", borderRadius: "8px", backgroundColor: "#28a745", color: "#fff", border: "none" }}
              >
                Upload Excel List
              </label>
            </div>
          )}
          
        </div>
        

        <hr className="form-divider" />

        <form className="modern-grid-form" onSubmit={handleSubmit}>
          {/* Section 1: Basic Info */}
          <div className="form-row">
            <div className="input-field">
              <label>Supplier Name </label>
              <input
                name="supplierName"
                value={form.supplierName}
                type="text"
                onChange={handleChange}
                
              />
            </div>
            <div className="input-field">
              <label>Company Name *</label>
              <input
                name="companyName"
                value={form.companyName}
                type="text"
                onChange={handleChange}
                required
              />
            </div>
          </div>
          {/* Section 2: Contact Info */}
          <div className="form-row">
            
            <div className="input-field">
              <label>Supplier Mobile </label>
              <input
                name="supplierMobileNumber"
                type="tel"
                value={form.supplierMobileNumber}
                onChange={handleChange}
                
              />
            </div>
            <div className="input-field">
              <label>Email Address </label>
              <input
                name="email"
                value={form.email}
                type="email"
                onChange={handleChange}
                
              />
            </div>
          </div>

          {/* Section 4: Secondary Contact */}
          <div className="form-row">
            <div className="input-field">
              <label>Company Phone</label>
              <input
                name="companyNumber"
                value={form.companyNumber}
                type="tel"
                onChange={handleChange}
              />
            </div>
            <div className="input-field">
              <label>Godown Number</label>
              <input
                name="godownNumber"
                value={form.godownNumber}
                type="text"
                onChange={handleChange}
              />
            </div>
          </div>

          {/* Section 5: Location */}
          <div className="form-row">
            <div className="input-field">
              <label>District </label>
              <input
                name="district"
                type="text"
                value={form.district}
                onChange={handleChange}
                
              />
            </div>
            <div className="input-field">
              <label>State </label>
              <input
                name="state"
                type="text"
                value={form.state}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="input-field">
              <label>Full Address </label>
              <input
                name="address"
                type="text"
                value={form.address}
                onChange={handleChange}
                
              />
            </div>
                      <div className="form-row">
  <div className="input-field">
    <label>GSTIN / UIN *</label>
    <input
      name="gstin"
      value={form.gstin}
      type="text"
      placeholder="e.g. 27AAAAA0000A1Z5"
      onChange={handleChange}
      style={{ textTransform: 'uppercase' }} // Visual helper for user
      maxLength={15}
      required
    />
  </div>
</div>

          </div>

          <div className="form-actions">
            <button
              type="button"
              className="discard-btn"
              onClick={() => router.back()}
            >
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={loading}>
              {loading
                ? "Saving..."
                : isEditMode
                  ? "Update Supplier"
                  : "Save Supplier Details"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddSupplier;