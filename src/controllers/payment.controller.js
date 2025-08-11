import { env } from "../config/env.js";
// src/controllers/payment.controller.js
import axios from "axios";
import pkg from "uuid";
import User from "../models/User.js";
const { v4: uuidv4 } = pkg;
const CHECKOUT_SECRET_KEY = process.env.CHECKOUT_SECRET_KEY; // sk_sbox_...
const PROCESSING_CHANNEL_ID = process.env.PROCESSING_CHANNEL_ID; // pc_...
const FRONTEND_BASE_URL = "https://question-banks-phi.vercel.app"; // صفحة النتيجة عندك
// const FRONTEND_BASE_URL = "https://payment-test-front-end.vercel.app"; // صفحة النتيجة عندك
// SERVER_BASE_URL computed from request
// ✅ POST /api/v1/payments/create-hosted-payment

export const createHostedPayment = async (req, res) => {
  try {
    // const userId = req.user.id;
    // console.log("UserID from request:", userId);
    // console.log("UserID from request body:", req.user);
    // console.log("Received request body:", req.body);
    const { Price, price, currency, customer, billing,userId, reference } =
      req.body || {};

    // Validate and normalize amount from major units to minor units
    const rawPrice = Price ?? price;
    const priceNumber = Number(rawPrice);
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
      return res.status(400).json({
        error: "Invalid amount",
        details: {
          error_type: "request_invalid",
          error_codes: ["amount_invalid"],
        },
      });
    }

    const currencyCode = (currency || "USD").toUpperCase();
    // Currency exponent map (minor units)
    const exponentByCurrency = {
      BIF: 0,
      CLP: 0,
      DJF: 0,
      GNF: 0,
      JPY: 0,
      KMF: 0,
      KRW: 0,
      MGA: 0,
      PYG: 0,
      RWF: 0,
      UGX: 0,
      VND: 0,
      VUV: 0,
      XAF: 0,
      XOF: 0,
      XPF: 0,
      BHD: 3,
      IQD: 3,
      JOD: 3,
      KWD: 3,
      LYD: 3,
      OMR: 3,
      TND: 3,
    };
    const exponent = Object.prototype.hasOwnProperty.call(
      exponentByCurrency,
      currencyCode
    )
      ? exponentByCurrency[currencyCode]
      : 2;
    // Avoid floating point issues: round to integer minor units
    const minorAmount = Math.round(priceNumber * 10 ** exponent);

    const hostedBody = {
      metadata: {
        userId: userId || req.body.userId,
      },
      reference: reference || `order_${uuidv4().slice(0, 8)}`,
      amount: minorAmount,
      currency: currencyCode,
      processing_channel_id: PROCESSING_CHANNEL_ID,
      customer: {
        name: customer?.name || "Customer",
        email: customer?.email || "no-reply@example.com",
      },
      billing: billing?.address?.country
        ? billing
        : { address: { country: "EG" } },
      // Checkout redirect URLs after payment
      success_url: `${req.protocol}://${req.get('host')}/api/payments/success`,
      failure_url: `${req.protocol}://${req.get('host')}/api/payments/fail`,
      cancel_url: `${req.protocol}://${req.get('host')}/api/payments/cancel`,
    };

    // console.log("Outgoing hosted payment body:", hostedBody);

    const chRes = await axios.post(
      "https://api.sandbox.checkout.com/hosted-payments",

      hostedBody,
      {
        headers: {
          Authorization: CHECKOUT_SECRET_KEY,
          "Content-Type": "application/json",
          "Cko-Idempotency-Key": uuidv4(),
        },
        timeout: 15000,
      }
    );
    // console.log("UserID after receive from front-end:", userId);
    return res.json({
      hosted_id: chRes.data.id,
      reference: chRes.data.reference,
      redirect_url: chRes.data._links?.redirect?.href,
    });
  } catch (error) {
    console.error("Checkout Error:", error?.response?.data || error.message);
    res.status(500).json({
      error: "فشل إنشاء جلسة الدفع الخارجية",
      details: error?.response?.data || error.message,
    });
  }
};

// ✅ GET /api/v1/payments/success?cko-payment-id=pay_xxx&cko-session-id=sid_xxx
export const paymentSuccess = async (req, res) => {
  try {
    const { "cko-payment-id": paymentId, "cko-session-id": sessionId } =
      req.query;

    if (!paymentId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Missing paymentId or sessionId in query parameters",
      });
    }

    const idToUse = paymentId || sessionId;

    const pRes = await axios.get(
      `https://api.sandbox.checkout.com/payments/${idToUse}`,
      { headers: { Authorization: CHECKOUT_SECRET_KEY }, timeout: 15000 }
    );

    const userId1 = pRes.data.metadata?.userId; // التأكد من أن userId موجود في الـ metadata
    const payload = Buffer.from(
      JSON.stringify({
        id: pRes.data.id,
        reference: pRes.data.reference,
        amount: pRes.data.amount,
        currency: pRes.data.currency,
        status: pRes.data.status,
        userId: userId1, // حفظ الـ userId من الـ metadata
        type: "success",
      })
    ).toString("base64");
    // دالة لاسترجاع جميع المستخدمين

    const getAllUsers = async () => {
      try {
        const users = await User.find(); // الحصول على جميع المستخدمين
        console.log("جميع المستخدمين:", users);
      } catch (error) {
        console.log("حدث خطأ:", error);
      }
    };
    // الاستخدام
    getAllUsers();

    // قم بتحديث حالة المستخدم بناءً على الـ userId المسترجع
    const updatedData = {
      isActive: false,
    };

    const updateUser = async (userId1, updatedData) => {
      try {
        const updatedUser = await User.findByIdAndUpdate(userId1, updatedData, {
          new: true,
        });
      } catch (error) {
        console.log("حدث خطأ أثناء تحديث المستخدم:", error);
      }
    };

    updateUser(userId1, updatedData);
    getAllUsers();

    return res.redirect(`${FRONTEND_BASE_URL}/my-banks?order=${payload}`);
  } catch (err) {
    console.log("خطأ أثناء المعالجة:", err);
    return res.redirect(`${FRONTEND_BASE_URL}/my-banks?error=payment_error`);
  }
};

// ✅ GET /api/v1/payments/fail
export const paymentFail = async (req, res) => {
  try {
    const { "cko-payment-id": paymentId, "cko-session-id": sessionId } =
      req.query;

    if (!paymentId && !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Missing paymentId or sessionId in query parameters",
      });
    }
    // console.log("Payment Ids:", paymentId);
    // console.log("Session Ids:", sessionId);
    // للأمان: لو عندنا paymentId استخدمه، وإلا جرّب sessionId

    const fetchedRequest = await axios.get(
      `https://api.sandbox.checkout.com/payments/${sessionId}`,
      { headers: { Authorization: CHECKOUT_SECRET_KEY }, timeout: 15000 }
    );
    // console.log("Fetched Request:", fetchedRequest.data);

    // console.log("Fetched Request:", fetchedRequest.data.status);

    console.log(
      "Order Summary:",
      fetchedRequest.data?.actions?.[0]?.response_summary
    );
    const payload = Buffer.from(
      JSON.stringify({
        status: fetchedRequest.data.status, // Authorized / Captured / Declined...
        action:
          fetchedRequest.data?.actions?.[0]?.response_summary ||
          "Unknown Reason",
        type: "fail", // Insufficient Funds
      })
    ).toString("base64");

    return res.redirect(`${FRONTEND_BASE_URL}/my-banks?order=${payload}`);
  } catch (err) {
    console.log("err:", err);

    return res.redirect(`${FRONTEND_BASE_URL}/my-banks?error=payment_error`);
  }
  // لو عايز تبعت رسالة فشل للعميل
  // return res.redirect(`${FRONTEND_BASE_URL}/payment-result?fail=true`);
};

// ✅ GET /api/v1/payments/cancel
export const paymentCancel = async (_req, res) => {
  return res.redirect(`${FRONTEND_BASE_URL}/my-banks?cancel=true`);
};
