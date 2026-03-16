import mongoose from "mongoose";

const SupplierDetailsSchema = new mongoose.Schema(
  {
    supplierId: {
    type: String,
    unique: true,
    required: true,
    },

    supplierName: {
      type: String,
      trim: true,
    },

    companyName: {
      type: String,
      required: true,
      trim: true,
    },
gstin: {
  type: String,
  uppercase: true,
  trim: true,
  unique: true,
  sparse: true,
  required: true, 
  match: [
    /^[0-9A-Z]{15}$/i, 
    "GSTIN must be exactly 15 characters (letters and numbers only)"
  ],
},
    address: {
      type: String,
      trim: true,
    },

    district: {
      type: String,
      trim: true,
    },

    state: {
      type: String,
      trim: true,
    },

    supplierMobileNumber: {
      type: String,
      match: [/^[0-9]{10,15}$/, "Invalid mobile number"],
    },

    companyNumber: {
      type: String,
      sparse: true, 
      match: [/^[0-9]{10,15}$/, "Invalid company phone number"],
      unique : true,
    },

    godownNumber: {
      type: String,
      trim: true,
    },

    email: {
      type: String,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },
    Date: {
    type: Date,
    required: true,
    default: Date.now, // automatically stores the entry time
    }


  },
  {
    timestamps: true,
  }
);

export default mongoose.models.SupplierDetails ||
  mongoose.model("SupplierDetails", SupplierDetailsSchema);
