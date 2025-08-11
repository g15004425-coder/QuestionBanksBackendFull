import mongoose from "mongoose";
import { PAYMENT_STATUS } from "../config/constants.js";

const paymentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "add_offer",
        "promote_offer",
        "unlock_contact",
        "promote_player",
        "promote_coach",
      ],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "SAR",
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
    },
    method: {
      type: String,
      enum: ["credit_card", "debit_card", "apple_pay", "stc_pay", "mada"],
    },
    gateway: {
      type: String,
      enum: ["hyperpay", "paytabs", "stripe"],
      default: "hyperpay",
    },
    gatewayResponse: {
      transactionId: String,
      checkoutId: String,
      referenceNumber: String,
      authCode: String,
      raw: mongoose.Schema.Types.Mixed,
    },
    relatedOffer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Offer",
    },
    relatedPlayer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Player",
    },
    relatedCoach: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Coach",
    },
    metadata: mongoose.Schema.Types.Mixed,
    invoice: {
      number: String,
      issuedAt: Date,
      dueDate: Date,
      items: [
        {
          description: String,
          quantity: Number,
          unitPrice: Number,
          total: Number,
        },
      ],
      vatAmount: Number,
      totalAmount: Number,
      zatcaCompliant: {
        qrCode: String,
        uuid: String,
        hash: String,
      },
    },
    failureReason: String,
    attempts: [
      {
        attemptedAt: { type: Date, default: Date.now },
        status: String,
        reason: String,
      },
    ],
    refund: {
      status: String,
      amount: Number,
      reason: String,
      refundedAt: Date,
      transactionId: String,
    },
    completedAt: Date,
    expiresAt: {
      type: Date,
      default: () => new Date(+new Date() + 30 * 60 * 1000), // 30 minutes
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
paymentSchema.index({ user: 1, status: 1 });
paymentSchema.index({ "gatewayResponse.transactionId": 1 });
paymentSchema.index({ createdAt: -1 });

// Generate invoice number
paymentSchema.methods.generateInvoiceNumber = function () {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `INV-${year}${month}-${random}`;
};

// Calculate VAT (15% in Saudi Arabia)
paymentSchema.methods.calculateVAT = function () {
  const vatRate = 0.15;
  const vatAmount = this.amount * vatRate;
  const totalAmount = this.amount + vatAmount;

  return {
    subtotal: this.amount,
    vatRate: vatRate * 100,
    vatAmount: parseFloat(vatAmount.toFixed(2)),
    totalAmount: parseFloat(totalAmount.toFixed(2)),
  };
};

// Generate ZATCA compliant QR code data
paymentSchema.methods.generateZATCAQRData = function () {
  // This is a simplified version. Real implementation would follow ZATCA specifications
  const sellerName = process.env.COMPANY_NAME || "Sports Platform";
  const vatNumber = process.env.COMPANY_VAT_NUMBER || "300000000000003";
  const timestamp = new Date().toISOString();
  const { totalAmount, vatAmount } = this.calculateVAT();

  const qrData = [
    { tag: 1, value: sellerName },
    { tag: 2, value: vatNumber },
    { tag: 3, value: timestamp },
    { tag: 4, value: totalAmount.toString() },
    { tag: 5, value: vatAmount.toString() },
  ];

  return Buffer.from(JSON.stringify(qrData)).toString("base64");
};

export default mongoose.model("Payment", paymentSchema);
