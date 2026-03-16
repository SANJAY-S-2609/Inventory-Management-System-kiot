import mongoose from "mongoose";

const DistributedItemsSchema = new mongoose.Schema(
  {
    itemId: {
      type: String,
      required: true,
      index: true, 
    },

    itemName: {
      type: String,
      required: true,
      trim: true,
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

    distributedTo: { //location
      type: String,
      required: true,
      trim: true,
    },

    receiverPerson: {
      type: String,
      required: true,
      trim: true,
    },

    numberOfItems: {
      type: Number,
      required: true,
      min: 1,
    },

    distributedDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps : true,
  }
);

export default mongoose.models.DistributedItems ||
  mongoose.model("DistributedItems", DistributedItemsSchema);
