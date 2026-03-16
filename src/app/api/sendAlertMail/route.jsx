
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import mongoose from "mongoose";

// 1. Create a quick internal Model to track alert timing
// This ensures we don't spam emails
const AlertLogSchema = new mongoose.Schema({
  lastSent: { type: Date, default: Date.now }
}, { collection: 'alert_logs' });

const AlertLog = mongoose.models.AlertLog || mongoose.model("AlertLog", AlertLogSchema);

const connectDB = async () => {
  if (mongoose.connections[0].readyState) return;
  await mongoose.connect(process.env.MONGODB_URI);
};

export async function POST(req) {
  try {
    await connectDB();
    const { items } = await req.json();

    // --- FREQUENCY CHECK LOGIC (2 DAYS) ---
    const lastAlert = await AlertLog.findOne().sort({ lastSent: -1 });
    
    if (lastAlert) {
      const currentTime = new Date();
      const lastSentTime = new Date(lastAlert.lastSent);
      const timeDifference = currentTime - lastSentTime;
      const fortyEightHours = 2 * 24 * 60 * 60 * 1000; // 2 days in milliseconds

      if (timeDifference < fortyEightHours) {
        return NextResponse.json({ 
          message: "Email skipped: An alert was already sent within the last 2 days." 
        }, { status: 200 });
      }
    }
    // --------------------------------------

    // Configure your email transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: '2k23cse167@kiot.ac.in', 
        pass: 'ojva pjfx odsz dcui', // Your 16-digit app password
      },
    });

    // Format the low stock items list for the email body
    const itemsList = items.map(i => `- ${i.name}: Only ${i.remaining} remaining`).join('\n');

    const mailOptions = {
      from: '"Inventory System" <2k23cse167@kiot.ac.in>',
      to: '2k23cse144@kiot.ac.in, 2k23cse167@kiot.ac.in, 2k23cse141@kiot.ac.in',
      subject: '⚠️ LOW STOCK ALERT - InvTrack',
      text: `The following items have dropped below 5 units:\n\n${itemsList}\n\nPlease restock soon.`,
    };

    await transporter.sendMail(mailOptions);

    // Update the database with the new "Last Sent" time
    await AlertLog.create({ lastSent: new Date() });

    return NextResponse.json({ message: "Alert sent successfully" }, { status: 200 });
  } catch (error) {
    console.error("Mail Error:", error);
    return NextResponse.json({ message: "Error sending email", details: error.message }, { status: 500 });
  }
}