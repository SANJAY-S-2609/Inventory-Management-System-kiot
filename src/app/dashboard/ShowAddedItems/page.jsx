"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./showAddedItems.css";

function ShowAddedItems() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");


  // States for Filtering
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockThreshold, setStockThreshold] = useState("");

  // --- Security States ---
  const [showNewPassModal, setShowNewPassModal] = useState(false); // UI state for Reset
  const [newPasswordInput, setNewPasswordInput] = useState("");   // Input for Reset
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [pendingItemId, setPendingItemId] = useState(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [otpInput, setOtpInput] = useState(new Array(6).fill(""));
  const [serverOtp, setServerOtp] = useState(""); // Stores generated OTP for verification
  const [timer, setTimer] = useState(60);
  const otpRefs = useRef([]);

  const router = useRouter();

  // Load items
  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await fetch("/api/AddItems");
        const data = await res.json();
        if (res.ok) setItems(data);
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    fetchItems();
  }, []);

  // Timer Logic
  useEffect(() => {
    let interval;
    if (showOtpModal && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    } else if (timer === 0) {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [showOtpModal, timer]);

  // --- SECURITY LOGIC ---
  const handleEditClick = (itemId) => {
    setPendingItemId(itemId);
    setShowPasswordModal(true);
  };

  // 1. Verify Password against Database (Login)
  const handlePasswordSubmit = async () => {
    try {
      const res = await fetch("/api/Admin-security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordInput }),
      });

      if (res.ok) {
        router.push(`/dashboard/Additem?itemId=${pendingItemId}`);
        setShowPasswordModal(false);
        setPasswordInput("");
      } else {
        alert("Invalid Admin Password. Try 'admin123' if first time.");
      }
    } catch (err) {
      alert("Security server error");
    }
  };

  // 2. Verify OTP then Show Reset UI
  const verifyOtp = () => {
    if (timer === 0) return alert("OTP Expired!");

    if (otpInput.join("") === serverOtp) {
      setShowOtpModal(false);
      setShowNewPassModal(true); // Switch to the Reset Password Modal
    } else {
      alert("Incorrect OTP");
    }
  };

  // 3. Update Database with New Password (Reset)
  const handleUpdatePassword = async () => {
    if (!newPasswordInput) return alert("Please enter a new password");

    try {
      const res = await fetch("/api/Admin-security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: newPasswordInput, isUpdate: true }),
      });

      if (res.ok) {
        alert("Password updated in database successfully!");
        setShowNewPassModal(false);
        setShowPasswordModal(true); // Return to Login modal
        setNewPasswordInput("");
      } else {
        alert("Failed to update database");
      }
    } catch (err) {
      alert("Database connection error");
    }
  };

  const generateAndSendOtp = async () => {
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setServerOtp(newOtp);
    setTimer(90);
    setOtpInput(new Array(6).fill(""));
    setShowPasswordModal(false);
    setShowOtpModal(true);

    try {
      const res = await fetch("/api/Send-Otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otp: newOtp }),
      });
      if (!res.ok) throw new Error("Failed to send");
    } catch (err) {
      alert("Error sending email OTP.");
    }
  };

  const handleOtpChange = (element, index) => {
    if (isNaN(element.value)) return;
    let newOtp = [...otpInput];
    newOtp[index] = element.value;
    setOtpInput(newOtp);
    if (element.value !== "" && index < 5) otpRefs.current[index + 1].focus();
  };



  // --- ORIGINAL FILTER & DOWNLOAD LOGIC ---
  const uniqueCategories = ["All", ...new Set(items.map((item) => item.category))];
  const filteredItems = items.filter((item) => {
    const matchesCategory = categoryFilter === "All" || item.category === categoryFilter;
    const matchesStock = stockThreshold === "" || item.quantity <= Number(stockThreshold);
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesCategory && matchesStock && matchesSearch;
  });

  const downloadExcel = () => {
    const excelData = filteredItems.map((item, index) => ({
      "S.No": index + 1, "Item Name": item.name, "Quantity": item.quantity,
      "Per": item.perItemPrice, "Unit": item.unit, "Original Price": item.originalPrice,
      "Discount %": item.discountPercentage, "Total Amount": item.totalAmount,
      "Company Name": item.companyName, "Phone": item.companyNumber, "Category": item.category,
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
    XLSX.writeFile(workbook, "Added_Items_Report.xlsx");
  };

  const downloadPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    doc.text("Inventory: Added Items List", 14, 15);
    const tableColumn = ["S.No", "Item Name", "Qty", "Unit", "Price", "Disc%", "Total", "Company", "Phone", "Category"];
    const tableRows = filteredItems.map((item, index) => [
      index + 1, item.name, item.quantity, item.unit, item.perItemPrice, item.originalPrice, item.discountPercentage, item.totalAmount, item.companyName, item.companyNumber, item.category
    ]);
    autoTable(doc, { head: [tableColumn], body: tableRows, startY: 28, theme: 'grid' });
    doc.save("Inventory_Items_Report.pdf");
  };

  return (
    <div className="show-items-container">
      {/* --- PASSWORD MODAL --- */}
      {showPasswordModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <h3>Authorization Required</h3>
            <input
              type="password"
              placeholder="Enter Admin Password"
              className="modal-input"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
            />
            <button className="modal-btn-primary" onClick={handlePasswordSubmit}>Login</button>
            <button className="modal-btn-forgot" onClick={generateAndSendOtp}>Forgot Password? (Send OTP)</button>
            <button className="modal-btn-close" onClick={() => setShowPasswordModal(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* --- OTP MODAL --- */}
      {showOtpModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <h3>Email Verification</h3>
            <p>Enter 6-digit code sent to authorized emails</p>
            <div className="otp-inputs-wrapper">
              {otpInput.map((data, index) => (
                <input
                  key={index}
                  type="text"
                  maxLength="1"
                  ref={(el) => (otpRefs.current[index] = el)}
                  value={data}
                  onChange={(e) => handleOtpChange(e.target, index)}
                  className="otp-field"
                />
              ))}
            </div>
            <p className="timer-display">Time left: <span style={{ color: timer < 10 ? 'red' : 'green' }}>{timer}s</span></p>

            <button className="modal-btn-primary" onClick={verifyOtp} disabled={timer === 0}>Verify OTP</button>
            {timer === 0 && (
              <button className="modal-btn-forgot" onClick={generateAndSendOtp}>Resend Code</button>
            )}
            <button className="modal-btn-close" onClick={() => setShowOtpModal(false)}>Close</button>
          </div>
        </div>
      )}
      {/* --- MODAL 3: RESET PASSWORD UI --- */}
      {showNewPassModal && (
        <div className="custom-modal-overlay">
          <div className="custom-modal">
            <h3>Reset Admin Password</h3>
            <p>Verification successful. Set your new password below:</p>
            <input
              type="password"
              placeholder="Enter New Password"
              className="modal-input"
              value={newPasswordInput}
              onChange={(e) => setNewPasswordInput(e.target.value)}
            />
            <button className="modal-btn-primary" onClick={handleUpdatePassword}>
              Update & Save Password
            </button>
            <button className="modal-btn-close" onClick={() => setShowNewPassModal(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="show-items-card">
        {/* Header Section */}
        <div className="show-items-header">
          <div className="header-info" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <h2>📦 Items List</h2>
            <div className="filter-group" style={{ display: 'flex', gap: '10px' }}>
              <select className="filter-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat === "All" ? "All Categories" : cat}</option>
                ))}
              </select>
              <input type="number" placeholder="Qty less than..." className="filter-input" value={stockThreshold} onChange={(e) => setStockThreshold(e.target.value)} />
            </div>
          </div>
          {/* --- ADD THIS SEARCH BOX SECTION --- */}
          <div className="search-container" style={{ marginRight: '20px' }}>
            <input
              type="text"
              className="search-input"
              placeholder="Search item name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="header-btns">
            <button className="download-btn excel-btn" onClick={downloadExcel}>📊 Excel Export</button>
            <button className="download-btn pdf-btn" onClick={downloadPDF}>📄 PDF Export</button>
          </div>
        </div>

        <div className="show-items-table-wrapper">
          <table className="show-items-table">
            <thead>
              <tr>
                <th>S.No</th><th>Item Name</th><th>Qty</th><th>Unit</th><th>Per</th><th>Original Price</th><th>Discount %</th><th>Total Amount</th><th>Company Name</th><th>Phone</th><th>Category</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="12" className="text-center">Loading...</td></tr>
              ) : filteredItems.length > 0 ? (
                filteredItems.map((item, index) => (
                  <tr key={item._id}>
                    <td>{index + 1}</td>
                    <td className="fw-bold">{item.name}</td>
                    <td style={{ color: item.quantity < 10 ? 'red' : 'inherit', fontWeight: item.quantity < 10 ? 'bold' : 'normal' }}>{item.quantity}</td>
                    <td>{item.unit}</td><td>{item.perItemPrice}</td><td>{item.originalPrice}</td><td>{item.discountPercentage}%</td>
                    <td className="text-success fw-bold">{item.totalAmount}</td>
                    <td>{item.companyName}</td><td>{item.companyNumber}</td>
                    <td><span className="cat-badge">{item.category}</span></td>
                    <td><button className="btn-edit" onClick={() => handleEditClick(item._id)}>Edit</button></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan="12" className="text-center">No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx>{`
        .custom-modal-overlay {
          position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6);
          display: flex; align-items: center; justify-content: center; z-index: 9999;
        }
        .custom-modal {
          background: white; padding: 30px; border-radius: 12px; width: 380px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        }
        .modal-input {
          width: 100%; padding: 12px; margin: 15px 0; border: 1px solid #ddd; border-radius: 6px;
        }
        .otp-inputs-wrapper {
          display: flex; gap: 8px; justify-content: center; margin: 20px 0;
        }
        .otp-field {
          width: 40px; height: 45px; text-align: center; font-size: 1.2rem; border: 2px solid #ddd; border-radius: 6px; outline: none;
        }
        .otp-field:focus { border-color: #6366f1; }
        .modal-btn-primary {
          width: 100%; padding: 12px; background: #6366f1; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;
        }
        .modal-btn-forgot {
          background: none; border: none; color: #6366f1; font-size: 0.85rem; text-decoration: underline; margin-top: 15px; cursor: pointer; display: block; width: 100%;
        }
        .modal-btn-close {
          background: none; border: none; color: #999; margin-top: 10px; cursor: pointer;
        }
        .timer-display { font-size: 0.9rem; margin-bottom: 15px; }
      `}</style>
    </div>
  );
}

export default ShowAddedItems;