"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx"; // <--- NEW IMPORT

function Additem() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const itemId = searchParams.get("itemId");
  const newSupplierIdFromUrl = searchParams.get("newSupplierId"); // Get ID back from redirect

  // State to track field errors
  const [errors, setErrors] = useState({});

  const [hsnSuggestions, setHsnSuggestions] = useState([]);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);

  const [supplierList, setSupplierList] = useState([]);

  // Helper to get today's date in YYYY-MM-DD format
  const getTodayDate = () => new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    hsnSac: "",
    name: "",
    category: "",
    quantity: "",
    minOrderLevel: "",
    unit: "",
    perItemPrice: "",
    originalPrice: "",
    discountPercentage: "0",
    gstPercentage: "0",
    totalAmount: "",
    supplierId: "",
    discountPrice: "",
    companyName: "",
    companyNumber: "",
    // Initialize with today's date
    purchaseDate: getTodayDate(),
  });
  // This handles fetching suggestions with a 300ms delay (Debounce)
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      // 1. HSN Suggestions
      if (formData.hsnSac.length > 2) {
        try {
          const res = await fetch(`/api/AddItems?searchHsn=${formData.hsnSac}`);
          const data = await res.json();
          setHsnSuggestions(data);
        } catch (err) {
          console.error(err);
        }
      } else {
        setHsnSuggestions([]);
      }

      // 2. Name Suggestions
      if (formData.name.length > 2) {
        try {
          const res = await fetch(
            `/api/AddItems?searchName=${formData.name}&searchHsn=${formData.hsnSac}`,
          );
          const data = await res.json();
          setNameSuggestions(data);
        } catch (err) {
          console.error(err);
        }
      } else {
        setNameSuggestions([]);
      }
    }, 300); // 300ms delay

    return () => clearTimeout(delayDebounceFn);
  }, [formData.hsnSac, formData.name]);

  // 1. SAFE EFFECT: Handle returning from Add Supplier
  useEffect(() => {
    if (newSupplierIdFromUrl && supplierList?.length > 0) {
      const draft = localStorage.getItem("item_form_draft");
      if (draft) {
        try {
          const parsedDraft = JSON.parse(draft);
          const newSup = supplierList.find(
            (s) => s?.supplierId === newSupplierIdFromUrl,
          );

          if (newSup) {
            // Define supplierData first so it can be used below
            const supplierData = {
              supplierId: newSup.supplierId,
              companyName: newSup.companyName,
              companyNumber:
                newSup.companyNumber || newSup.supplierMobileNumber || "",
            };

            // Update the form: Draft + New Supplier info
            setFormData((prev) => ({
              ...prev,
              ...parsedDraft,
              ...supplierData,
            }));

            // Sync pending_supplier for your batch adding logic
            localStorage.setItem(
              "pending_supplier",
              JSON.stringify({
                ...supplierData,
                purchaseDate: parsedDraft.purchaseDate || getTodayDate(),
              }),
            );

            // Clean up
            localStorage.removeItem("item_form_draft");

            // Use router.replace to remove the ID from the URL bar
            // (prevents this from running again if you refresh)
            router.replace("/dashboard/Additem");
          }
        } catch (e) {
          console.error("Error parsing draft:", e);
        }
      }
    }
  }, [newSupplierIdFromUrl, supplierList, router]);

  // Inside Additem.jsx
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch("/api/Supplier");
        const data = await res.json();

        // Safety check: Ensure data is an array to prevent .find() crashes
        if (Array.isArray(data)) {
          setSupplierList(data);
        } else {
          console.error("Expected array from API, got:", data);
          setSupplierList([]); // Fallback to empty array
        }
      } catch (err) {
        console.error("Error fetching suppliers", err);
        setSupplierList([]);
      }
    };
    fetchSuppliers();
  }, []);

  useEffect(() => {
    if (itemId) {
      const fetchItem = async () => {
        try {
          const res = await fetch(`/api/AddItems?itemId=${itemId}`);
          const data = await res.json();
          setFormData({
            ...data,
            perItemPrice: data.perItemPrice || "",
            gstPercentage: data.gstPercentage || "",
            minOrderLevel: data.minOrderLevel || "",
            // If editing, use saved date or today
            purchaseDate: data.purchaseDate
              ? data.purchaseDate.split("T")[0]
              : getTodayDate(),
          });
        } catch (err) {
          console.error("Failed to fetch item:", err);
        }
      };
      fetchItem();
    } else {
      const urlSid = searchParams.get("supplierId");
      const urlCName = searchParams.get("companyName");
      const urlCPhone = searchParams.get("companyNumber");

      const rawSavedSupplier = localStorage.getItem("pending_supplier");
      let savedSupplier = null;

      // Safety check for JSON parsing
      if (rawSavedSupplier && rawSavedSupplier !== "undefined") {
        try {
          savedSupplier = JSON.parse(rawSavedSupplier);
        } catch (e) {
          savedSupplier = null;
        }
      }

      const pendingBatch = JSON.parse(
        localStorage.getItem("pending_batch_items") || "[]",
      );
      const isBatchInProgress = pendingBatch.length > 0;

      if (urlSid) {
        setFormData((prev) => ({
          ...prev,
          supplierId: urlSid,
          companyName: urlCName,
          companyNumber: urlCPhone,
        }));
      } else if (savedSupplier?.supplierId) {
        // Added ?. safety check here
        setFormData((prev) => ({
          ...prev,
          supplierId: savedSupplier.supplierId,
          companyName: savedSupplier.companyName,
          companyNumber: savedSupplier.companyNumber,
          purchaseDate: isBatchInProgress
            ? savedSupplier.purchaseDate || getTodayDate()
            : getTodayDate(),
        }));
      }
    }
  }, [itemId, searchParams]);

  // --- EXCEL UPLOAD HANDLERS (NEW) ---
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0]; // Get the first sheet
      const ws = wb.Sheets[wsname];
      // Convert sheet to JSON based on headers (name, hsnSac)
      const data = XLSX.utils.sheet_to_json(ws);

      uploadMasterList(data);
    };
    reader.readAsBinaryString(file);
  };

  const uploadMasterList = async (data) => {
    try {
      const res = await fetch("/api/bulk-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        alert("✅ Excel List Uploaded! You can now search by Name or HSN.");
      } else {
        alert("❌ Failed to upload some items (likely duplicates).");
      }
    } catch (err) {
      console.error(err);
      alert("Error connecting to server.");
    }
  };
  // ------------------------------------

  const handleSupplierChange = (e) => {
    const selectedId = e.target.value;
    let newErrors = { ...errors }; // Access current errors

    // NEW LOGIC: Handle "Add New" selection
    if (selectedId === "ADD_NEW") {
      // Save current form progress so user doesn't lose HSN/Name/Qty
      localStorage.setItem("item_form_draft", JSON.stringify(formData));
      // Route to supplier page with a flag
      router.push("/dashboard/AddSupplier?from=addItem");
      return;
    }

    // 1. Handle "No Supplier" selected
    if (!selectedId) {
      setFormData((prev) => ({
        ...prev,
        supplierId: "",
        companyName: "",
        companyNumber: "",
      }));
      localStorage.removeItem("pending_supplier");
      return;
    }

    // 2. Handle "OTHER / CASH" selected
    if (selectedId === "OTHER") {
      // FIX: Define the constant first so it can be used below
      const otherData = {
        supplierId: "OTHER",
        companyName: "Cash/Other Supplier",
        companyNumber: "0000000000",
        purchaseDate: formData.purchaseDate,
      };

      // Update React State
      setFormData((prev) => ({ ...prev, ...otherData }));

      // Update Local Storage
      localStorage.setItem("pending_supplier", JSON.stringify(otherData));
      return;
    }

    const supplier = supplierList.find((s) => s.supplierId === selectedId);

    if (supplier) {
      const num = supplier.companyNumber || supplier.supplierMobileNumber || "";
      if (num && num.length !== 10) {
        newErrors.companyNumber =
          "⚠️ Supplier's saved number is invalid (must be 10 digits)";
      } else {
        delete newErrors.companyNumber;
      }

      const supplierData = {
        supplierId: supplier.supplierId,
        companyName: supplier.companyName,
        companyNumber:
          supplier.companyNumber || supplier.supplierMobileNumber || "",
        purchaseDate: formData.purchaseDate, // Keep currently selected date
      };
      setFormData((prev) => ({ ...prev, ...supplierData }));

      // Update local storage
      localStorage.setItem("pending_supplier", JSON.stringify(supplierData));
    } else {
      setFormData((prev) => ({
        ...prev,
        supplierId: "",
        companyName: "",
        companyNumber: "",
      }));
    }
    setErrors(newErrors); // Update the error state
  };

  const handleNameFocus = async () => {
    if (formData.hsnSac.length > 2) {
      const res = await fetch(
        `/api/AddItems?searchName=${formData.name}&searchHsn=${formData.hsnSac}`,
      );
      const data = await res.json();
      setNameSuggestions(data);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let newErrors = { ...errors };

    if (name === "name" || name === "hsnSac") {
      setSelectedItemId(null);
    }

    // --- VALIDATION LOGIC ---
    if (name === "quantity") {
      if (value && isNaN(value)) {
        newErrors.quantity = "There should only be numbers";
      } else {
        delete newErrors.quantity;
      }
    }

    if (name === "minOrderLevel") {
      if (value && isNaN(value)) {
        newErrors.minOrderLevel = "There should only be numbers";
      } else {
        delete newErrors.minOrderLevel;
      }
    }

    if (name === "perItemPrice") {
      if (value && isNaN(value)) {
        newErrors.perItemPrice = "There should only be numbers";
      } else {
        delete newErrors.perItemPrice;
      }
    }

    if (name === "discountPercentage") {
      if (Number(value) > 100) {
        newErrors.discountPercentage = "Do Not Exceed Above 100%";
      } else {
        delete newErrors.discountPercentage;
      }
    }

    if (name === "gstPercentage") {
      if (Number(value) > 100) {
        newErrors.gstPercentage = "Do Not Exceed Above 100%";
      } else if (Number(value) < 0) {
        newErrors.gstPercentage = "GST Should Be Positive";
      } else {
        delete newErrors.gstPercentage;
      }
    }

    setErrors(newErrors);
    if (
      (name === "discountPercentage" || name === "gstPercentage") &&
      value.length > 2
    ) {
      return;
    }

    // If Date changes, update localStorage immediately if a supplier is already selected
    if (name === "purchaseDate" && formData.supplierId) {
      localStorage.setItem(
        "pending_supplier",
        JSON.stringify({
          supplierId: formData.supplierId,
          companyName: formData.companyName,
          companyNumber: formData.companyNumber,
          purchaseDate: value,
        }),
      );
    }

    // --- DATA UPDATE & CALCULATION ---
    setFormData((prev) => {
      let updatedData = { ...prev, [name]: value };

      const qty =
        name === "quantity" ? Number(value) : Number(prev.quantity || 0);
      const price =
        name === "perItemPrice"
          ? Number(value)
          : Number(prev.perItemPrice || 0);

      const newOriginalPrice = qty * price;
      updatedData.originalPrice = newOriginalPrice.toFixed(2);

      const discountPercent =
        name === "discountPercentage"
          ? Number(value || 0)
          : Number(prev.discountPercentage || 0);
      const gstPercent =
        name === "gstPercentage"
          ? Number(value || 0)
          : Number(prev.gstPercentage || 0);

      if (newOriginalPrice > 0) {
        const effectiveDiscount = Math.min(discountPercent, 100);
        const discountAmount = (newOriginalPrice * effectiveDiscount) / 100;

        updatedData.discountPrice = discountAmount.toFixed(2);
        const taxableValue = newOriginalPrice - discountAmount;
        const gstAmount = (taxableValue * gstPercent) / 100;
        updatedData.totalAmount = (taxableValue + gstAmount).toFixed(2);
      } else {
        updatedData.discountPrice = "0.00";
        updatedData.totalAmount = "0.00";
      }

      return updatedData;
    });
  };

  const handleSelectSuggestion = async (item) => {
    setFormData((prev) => ({
      ...prev,
      hsnSac: item.hsnSac.toString(),
      name: item.name,
      category: item.category,
      unit: item.unit,
      minOrderLevel: item.minOrderLevel || "",
    }));
    setSelectedItemId(item.itemId);

    try {
      const res = await fetch(`/api/AddItems?getLatestHistory=${item.itemId}`);
      if (res.ok) {
        const latestHistory = await res.json();
        if (latestHistory && latestHistory.minOrderLevel !== undefined) {
          setFormData((prev) => ({
            ...prev,
            minOrderLevel: latestHistory.minOrderLevel.toString(),
          }));
        }
      }
    } catch (err) {
      console.error("Failed to fetch latest history for pre-fill:", err);
    }

    setHsnSuggestions([]);
    setNameSuggestions([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (Object.keys(errors).length > 0) {
      alert("Please fix the highlighted errors before submitting.");
      return;
    }

    if (!formData.supplierId) {
      alert("Please select a supplier first.");
      return;
    }

    if (!formData.purchaseDate) {
      alert("Please select a date.");
      return;
    }

    const isEditMode = !!itemId;

    if (isEditMode) {
      try {
        const { itemId: uuidIgnored, ...sendData } = formData;

        const res = await fetch("/api/AddItems", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recordId: itemId, ...sendData }),
        });

        if (!res.ok) throw new Error("Failed to update item");

        alert("Item updated successfully ✅");
        router.push("/dashboard/ShowAddedItems");
      } catch (err) {
        console.error(err);
        alert("Error updating item ❌");
      }
    } else {
      const tempEntry = {
        ...formData,
        tempId: Date.now(),
        existingItemId: selectedItemId,
      };

      const currentList = JSON.parse(
        localStorage.getItem("pending_batch_items") || "[]",
      );
      currentList.push(tempEntry);

      localStorage.setItem("pending_batch_items", JSON.stringify(currentList));

      // Save Date along with Supplier info
      localStorage.setItem(
        "pending_supplier",
        JSON.stringify({
          supplierId: formData.supplierId,
          companyName: formData.companyName,
          companyNumber: formData.companyNumber,
          purchaseDate: formData.purchaseDate, // Save the date so it locks for next item
        }),
      );

      alert(
        "Item added to temporary list! You can now add one more item or click 'Stop Adding'. ✅",
      );

      // Reset form but KEEP Supplier and Date
      setFormData((prev) => ({
        ...prev,
        name: "",
        quantity: "",
        minOrderLevel: "",
        unit: "",
        originalPrice: "",
        perItemPrice: "",
        discountPercentage: "0",
        gstPercentage: "0",
        discountPrice: "",
        totalAmount: "",
        hsnSac: "",
        category: "",
        purchaseDate: prev.purchaseDate, // Explicitly keep the date for the next item in this batch

        // Note: We do NOT reset purchaseDate here
      }));
    }
  };

  const isNavigationLocked =
    !itemId &&
    JSON.parse(
      typeof window !== "undefined"
        ? localStorage.getItem("pending_batch_items") || "[]"
        : "[]",
    ).length > 0;

  const blockKeys = (e) =>
    ["e", "E", "+", "-"].includes(e.key) && e.preventDefault();

  return (
    <div className="add-item-container">
      <div
        className="bg-white shadow-lg w-100 p-2 rounded-4"
        style={{ maxWidth: "1400px" }}
      >
        {/* REPLACED HEADER DIV TO INCLUDE BUTTON */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 className="fw-semibold">
            {itemId ? "✏️ Edit Item" : "📦 Add New Item"}
          </h2>

          {!itemId && (
            <div>
              <input
                type="file"
                id="excelUpload"
                hidden
                accept=".xlsx, .xls"
                onChange={handleExcelUpload}
              />
              <label
                htmlFor="excelUpload"
                className="btn btn-success btn-sm fw-bold shadow-sm"
                style={{ cursor: "pointer" }}
              >
                <i className="bi bi-file-earmark-spreadsheet me-2"></i>
                Upload Excel List
              </label>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* ROW 1 */}
          <div className="row g-4 px-2 mb-2">
            {/* HSN COLUMN */}
            <div className="col-md-4 position-relative">
              <label className="form-label fw-medium">HSN / SAC</label>
              <span className="text-danger">*</span>
              <input
                className="form-control"
                name="hsnSac"
                autoComplete="off"
                value={formData.hsnSac}
                onChange={handleChange}
                onBlur={() => setTimeout(() => setHsnSuggestions([]), 200)}
                required
              />
              {hsnSuggestions.length > 0 && (
                <ul
                  className="list-group position-absolute w-100 z-3 shadow-lg"
                  style={{ top: "100%", maxHeight: "200px", overflowY: "auto" }}
                >
                  {Array.from(new Set(hsnSuggestions.map((a) => a.hsnSac)))
                    .map((hsn) => hsnSuggestions.find((a) => a.hsnSac === hsn))
                    .map((item) => (
                      <li
                        key={item._id}
                        className="list-group-item list-group-item-action cursor-pointer"
                        style={{ cursor: "pointer" }}
                        onMouseDown={() => {
                          setFormData((p) => ({
                            ...p,
                            hsnSac: item.hsnSac.toString(),
                          }));
                          setHsnSuggestions([]);
                        }}
                      >
                        <strong>{item.hsnSac}</strong>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            {/* NAME COLUMN */}
            <div className="col-md-4 position-relative">
              <label className="form-label fw-medium">Item Name</label>
              <span className="text-danger">*</span>
              <input
                className="form-control"
                name="name"
                autoComplete="off"
                value={formData.name}
                onChange={handleChange}
                onFocus={handleNameFocus}
                onBlur={() => setTimeout(() => setNameSuggestions([]), 200)}
                required
              />
              {nameSuggestions.length > 0 && (
                <ul
                  className="list-group position-absolute w-100 z-3 shadow-lg"
                  style={{ top: "100%", maxHeight: "200px", overflowY: "auto" }}
                >
                  {Array.from(
                    new Set(nameSuggestions.map((item) => item.name)),
                  ).map((itemName) => {
                    const item = nameSuggestions.find(
                      (i) => i.name === itemName,
                    );
                    return (
                      <li
                        key={item._id}
                        className="list-group-item list-group-item-action"
                        style={{ cursor: "pointer" }}
                        onMouseDown={() => handleSelectSuggestion(item)}
                      >
                        {item.name}{" "}
                        <small className="text-muted">({item.category})</small>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="col-md-4">
              <label className="form-label fw-medium">Item Category</label>
              <span className="text-danger">*</span>

              <select
                className="form-select"
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="">Select Category</option>
                <option>Plumbing items</option>
                <option>Electrical items</option>
                <option>Painting items</option>
                <option>Carpentry items</option>
                <option>Sanitation items</option>
                <option>Hardware items</option>
                <option>Scavenger items</option>
              </select>
            </div>
          </div>

          {/* ROW 2 */}
          <div className="row g-4 px-2 mb-2">
            <div className="col-md-4">
              <label className="form-label fw-medium">Unit</label>
              <span className="text-danger">*</span>

              <select
                className="form-select"
                name="unit"
                value={formData.unit}
                onChange={handleChange}
                required
              >
                <option value="">Select Unit</option>
                <option>pcs</option>
                <option>kg</option>
                <option>number</option>
                <option>roll</option>
                <option>length</option>
                <option>g</option>
                <option>liter</option>
                <option>ml</option>
                <option>box</option>
                <option>packet</option>
                <option>dozen</option>
                <option>m</option>
                <option>cm</option>
                <option>mm</option>
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label fw-medium">Quantity</label>
              <span className="text-danger">*</span>

              <input
                className="form-control"
                type="number"
                name="quantity"
                value={formData.quantity}
                onChange={handleChange}
                onKeyDown={blockKeys}
                required
                style={errors.quantity ? { border: "1px solid red" } : {}}
              />
              {errors.quantity && (
                <small style={{ color: "red" }}>{errors.quantity}</small>
              )}
            </div>

            <div className="col-md-4">
              <label className="form-label fw-medium">
                Minimum Order Level
              </label>
              <span className="text-danger">*</span>

              <input
                className="form-control"
                type="number"
                name="minOrderLevel"
                value={formData.minOrderLevel}
                onChange={handleChange}
                onKeyDown={blockKeys}
                required
                style={errors.minOrderLevel ? { border: "1px solid red" } : {}}
              />
              {errors.minOrderLevel && (
                <small style={{ color: "red" }}>{errors.minOrderLevel}</small>
              )}
            </div>
          </div>

          {/* ROW 3 */}
          <div className="row g-4 px-2 mb-2">
            <div className="col-md-4">
              <label className="form-label fw-medium">Unit Price</label>
              <span className="text-danger">*</span>

              <input
                className="form-control"
                type="number"
                name="perItemPrice"
                value={formData.perItemPrice}
                onChange={handleChange}
                onKeyDown={blockKeys}
                required
                style={errors.perItemPrice ? { border: "1px solid red" } : {}}
              />
              {errors.perItemPrice && (
                <small style={{ color: "red" }}>{errors.perItemPrice}</small>
              )}
            </div>

            <div className="col-md-4">
              <label className="form-label fw-medium">Total Price</label>
              <input
                className="form-control bg-light"
                type="number"
                name="originalPrice"
                value={formData.originalPrice}
                readOnly
              />
            </div>

            <div className="col-md-4">
              <label className="form-label fw-medium">Discount %</label>
              <input
                className="form-control"
                type="number"
                name="discountPercentage"
                value={formData.discountPercentage}
                onChange={handleChange}
                onKeyDown={blockKeys}
                placeholder="0"
                style={
                  errors.discountPercentage ? { border: "1px solid red" } : {}
                }
              />
              {errors.discountPercentage && (
                <small style={{ color: "red" }}>
                  {errors.discountPercentage}
                </small>
              )}
            </div>
          </div>

          {/* COMBINED ROW 4: GST, Final Amount, Supplier (col-md-4 each) */}
          <div className="row g-4 px-2 mb-2">
            {/* GST */}
            <div className="col-md-4">
              <label className="form-label fw-medium">GST %</label>
              <input
                className="form-control"
                type="number"
                name="gstPercentage"
                value={formData.gstPercentage}
                onChange={handleChange}
                onKeyDown={blockKeys}
                placeholder="0"
                style={errors.gstPercentage ? { border: "1px solid red" } : {}}
              />
              {errors.gstPercentage && (
                <small style={{ color: "red" }}>{errors.gstPercentage}</small>
              )}
            </div>

            {/* FINAL AMOUNT */}
            <div className="col-md-4">
              <label
                className="form-label fw-bold"
                style={{ fontSize: "1.1rem" }}
              >
                Final Amount
              </label>
              <input
                className="form-control fw-bold"
                type="number"
                name="totalAmount"
                value={formData.totalAmount}
                readOnly
                style={{
                  backgroundColor: "#f8f9fa",
                  fontSize: "1.2rem",
                  color: "#2be317d9",
                }}
              />
            </div>

            {!itemId && (
              <>
                {/* SUPPLIER */}
                <div className="col-md-4">
                  <label className="form-label fw-bold">Select Supplier</label>
                  <span className="text-danger">*</span>

                  <select
                    className="form-select"
                    value={formData.supplierId}
                    onChange={handleSupplierChange}
                    style={
                      errors.companyNumber ? { border: "2px solid red" } : {}
                    } // Highlight red if error
                    disabled={isNavigationLocked}
                    required
                  >
                    <option value="">-- Click to choose --</option>

                    {supplierList.map((s) => (
                      <option key={s._id} value={s.supplierId}>
                        {s.companyName} ({s.supplierName})
                      </option>
                    ))}
                    <option value="OTHER" style={{ color: "blue" }}>
                      + Other / One-time Purchase
                    </option>
                    {/* ADD THIS AT THE BOTTOM */}
                    <option
                      value="ADD_NEW"
                      style={{
                        fontWeight: "bold",
                        color: "green",
                        backgroundColor: "#eaffea",
                      }}
                    >
                      + Add New Supplier
                    </option>
                  </select>
                  {errors.companyNumber && (
                    <div
                      className="text-danger fw-bold mt-1"
                      style={{ fontSize: "0.85rem" }}
                    >
                      {errors.companyNumber}
                    </div>
                  )}
                  {/* If OTHER is selected, let them type the name */}
                  {formData.supplierId === "OTHER" && (
                    <div className="mt-2">
                      <input
                        type="text"
                        placeholder="Type Supplier Name (Optional)"
                        className="form-control"
                        value={
                          formData.companyName === "Cash/Other Supplier"
                            ? ""
                            : formData.companyName
                        }
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            companyName: e.target.value,
                          })
                        }
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ROW 5: PURCHASE DATE (First Column) */}
          {!itemId && (
            <div className="row g-4 px-2 mb-4">
              <div className="col-md-4">
                <label className="form-label fw-bold">Purchase Date</label>
                <input
                  type="date"
                  className="form-control"
                  name="purchaseDate"
                  value={formData.purchaseDate}
                  onChange={handleChange}
                  disabled={isNavigationLocked} // Locks when 2nd item is being added
                  required
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="d-flex justify-content-end gap-3 mt-4 pt-3 border-top">
            {/* ONLY SHOW YELLOW BUTTON IF COUNT > 0 */}
            {(typeof window !== "undefined"
              ? JSON.parse(localStorage.getItem("pending_batch_items") || "[]")
                  .length
              : 0) > 0 && (
              <button
                type="button"
                className="btn btn-warning px-4 py-2 fw-semibold rounded-3"
                onClick={() => router.push("/dashboard/ReviewItems")}
              >
                Stop Adding & View List (
                {
                  JSON.parse(
                    localStorage.getItem("pending_batch_items") || "[]",
                  ).length
                }
                )
              </button>
            )}

            <button
              type="submit"
              className="btn btn-primary px-4 py-2 fw-semibold rounded-3"
              disabled={Object.keys(errors).length > 0}
            >
              {itemId ? "Update Item" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Additem;
