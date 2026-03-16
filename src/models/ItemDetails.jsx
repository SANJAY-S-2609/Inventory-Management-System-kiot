import mongoose from "mongoose";

const ItemDetailsSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
    },

    perItemPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    supplierId: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
    },

    companyName: {
      type: String,
      trim: true,
      required:true,
    },

    companyNumber: {
      type: String,
      match: [/^[0-9]{10}$/, "Phone number must be exactly 10 digits"],
    },

    unit: {
      type: String,
      required: true,
      enum: [
       "pcs",
        "number",
        "length",
        "roll",
        "kg",
        "g",
        "liter",
        "ml",
        "m",
        "cm",
        "mm",
        "box",
        "packet",
        "dozen",
      ],
    },

    originalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    discountPercentage: {
      type: Number,
      min: 0,
      max: 100,
    },

    discountPrice: {
      type: Number,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    hsnSac: {
      type: Number,
      required: true,
    },

    category: {
      type: String,
      required: true,
      enum: [
        "Plumbing items",
        "Electrical items",
        "Painting items",
        "Carpentry items",
        "Sanitation items",
        "Hardware items",
        "Scavenger items",
      ],
    },

    Date: {
      type: Date,
      required: true,
      default:Date.now,
    },

    minOrderLevel: {
      type: Number,
      required: true,
      min: 0,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: false, 
      trim: true,
    },

    distributed: {
      type: Number,
      default:0,
    },
    
    gstPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 28,
    },
  },

  {
    timestamps: true,
  }
);

export default mongoose.models.ItemDetails ||
  mongoose.model("ItemDetails", ItemDetailsSchema);
