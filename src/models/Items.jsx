import mongoose from "mongoose";

const ItemsSchema  = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
      unique: true, // NO DUPLICATES HERE
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // minOrderLevel: {
    //   type: Number,
    //   required: true,
    //   min: 0,
    // },

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

    hsnSac: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.Items || mongoose.model("Items", ItemsSchema);
