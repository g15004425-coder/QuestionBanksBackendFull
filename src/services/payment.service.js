import Payment from "../models/payment.model.js";
import Invoice from "../models/invoice.model.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";
import { PAYMENT_STATUS } from "../config/constants.js";

class PaymentService {
  constructor() {
    this.gateway = this.initializeGateway();
  }

  initializeGateway() {
    // Initialize payment gateway based on environment variable
    const gateway = process.env.PAYMENT_GATEWAY || "hyperpay";

    switch (gateway) {
      case "hyperpay":
        return new HyperpayGateway();
      case "paytabs":
        return new PaytabsGateway();
      default:
        return new MockPaymentGateway();
    }
  }

  async createPayment(paymentData) {
    const payment = await Payment.create(paymentData);

    // Generate invoice
    await this.generateInvoice(payment);

    return payment;
  }

  async initiatePayment(paymentId) {
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      throw new ApiError(404, "Payment not found");
    }

    if (payment.status !== PAYMENT_STATUS.PENDING) {
      throw new ApiError(400, "Payment already processed");
    }

    // Check if payment expired
    if (payment.expiresAt < new Date()) {
      payment.status = PAYMENT_STATUS.FAILED;
      payment.failureReason = "Payment expired";
      await payment.save();
      throw new ApiError(400, "Payment has expired");
    }

    try {
      // Calculate total with VAT
      const { totalAmount } = payment.calculateVAT();

      // Create checkout session with payment gateway
      const checkoutData = await this.gateway.createCheckout({
        amount: totalAmount,
        currency: payment.currency,
        orderId: payment._id.toString(),
        description: `Payment for ${payment.type}`,
        customerEmail: payment.user.email,
        returnUrl: `${process.env.FRONTEND_URL}/payment/success`,
        cancelUrl: `${process.env.FRONTEND_URL}/payment/cancel`,
        webhookUrl: `${process.env.API_URL}/api/v1/payments/webhook`,
      });

      // Update payment with gateway response
      payment.gatewayResponse.checkoutId = checkoutData.checkoutId;
      payment.attempts.push({
        status: "initiated",
        reason: "Checkout created",
      });
      await payment.save();

      return checkoutData.checkoutUrl;
    } catch (error) {
      logger.error("Payment initiation error:", error);

      payment.attempts.push({
        status: "failed",
        reason: error.message,
      });
      await payment.save();

      throw new ApiError(500, "Failed to initiate payment");
    }
  }

  async verifyPayment(paymentId) {
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      throw new ApiError(404, "Payment not found");
    }

    try {
      // Verify payment status with gateway
      const result = await this.gateway.verifyPayment(
        payment.gatewayResponse.checkoutId
      );

      if (result.success) {
        payment.status = PAYMENT_STATUS.COMPLETED;
        payment.completedAt = new Date();
        payment.gatewayResponse.transactionId = result.transactionId;
        payment.gatewayResponse.referenceNumber = result.referenceNumber;
        payment.gatewayResponse.authCode = result.authCode;
        payment.method = result.paymentMethod;

        // Update invoice
        const invoice = await Invoice.findOne({ payment: payment._id });
        if (invoice) {
          invoice.status = "paid";
          invoice.paidAt = new Date();
          await invoice.save();
        }
      } else {
        payment.status = PAYMENT_STATUS.FAILED;
        payment.failureReason = result.reason;
      }

      payment.attempts.push({
        status: result.success ? "completed" : "failed",
        reason: result.reason || "Payment verified",
      });

      await payment.save();

      return payment;
    } catch (error) {
      logger.error("Payment verification error:", error);
      throw new ApiError(500, "Failed to verify payment");
    }
  }

  async handleWebhook(webhookData) {
    try {
      // Verify webhook signature
      const isValid = await this.gateway.verifyWebhook(webhookData);
      if (!isValid) {
        throw new ApiError(400, "Invalid webhook signature");
      }

      const payment = await Payment.findOne({
        "gatewayResponse.checkoutId": webhookData.checkoutId,
      });

      if (!payment) {
        throw new ApiError(404, "Payment not found");
      }

      // Update payment status based on webhook data
      if (webhookData.status === "success") {
        payment.status = PAYMENT_STATUS.COMPLETED;
        payment.completedAt = new Date();
        payment.gatewayResponse.transactionId = webhookData.transactionId;
      } else {
        payment.status = PAYMENT_STATUS.FAILED;
        payment.failureReason = webhookData.reason;
      }

      await payment.save();

      // Process post-payment actions
      if (payment.status === PAYMENT_STATUS.COMPLETED) {
        await this.processPostPaymentActions(payment);
      }

      return { success: true };
    } catch (error) {
      logger.error("Webhook processing error:", error);
      throw error;
    }
  }

  async processPostPaymentActions(payment) {
    // This will be called by the specific service handling the payment
    // For example, offer service will activate the offer
    // Player service will promote the player, etc.
    logger.info(`Processing post-payment actions for payment ${payment._id}`);
  }

  async generateInvoice(payment) {
    const invoice = new Invoice({
      payment: payment._id,
      user: payment.user,
      invoiceNumber: payment.generateInvoiceNumber(),
      billingInfo: {
        name: payment.user.name,
        email: payment.user.email,
        phone: payment.user.phone,
      },
      items: [
        {
          description: {
            en: `Payment for ${payment.type.replace(/_/g, " ")}`,
            ar: this.getArabicDescription(payment.type),
          },
          quantity: 1,
          unitPrice: payment.amount,
          taxRate: 15,
          total: payment.amount,
        },
      ],
      ...payment.calculateVAT(),
    });

    // Generate ZATCA compliant data
    await invoice.generateZATCACompliantData();

    return invoice.save();
  }

  async getPaymentHistory(userId, filters = {}) {
    const query = { user: userId };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from) query.createdAt.$gte = new Date(filters.from);
      if (filters.to) query.createdAt.$lte = new Date(filters.to);
    }

    const payments = await Payment.find(query)
      .sort({ createdAt: -1 })
      .populate("relatedOffer", "title")
      .populate("relatedPlayer", "name")
      .populate("relatedCoach", "name");

    return payments;
  }

  async refundPayment(paymentId, reason) {
    const payment = await Payment.findById(paymentId);

    if (!payment) {
      throw new ApiError(404, "Payment not found");
    }

    if (payment.status !== PAYMENT_STATUS.COMPLETED) {
      throw new ApiError(400, "Only completed payments can be refunded");
    }

    if (payment.refund?.status === "completed") {
      throw new ApiError(400, "Payment already refunded");
    }

    try {
      // Process refund with gateway
      const refundResult = await this.gateway.refundPayment(
        payment.gatewayResponse.transactionId,
        payment.amount
      );

      payment.status = PAYMENT_STATUS.REFUNDED;
      payment.refund = {
        status: "completed",
        amount: payment.amount,
        reason,
        refundedAt: new Date(),
        transactionId: refundResult.refundTransactionId,
      };

      await payment.save();

      // Update related entities (offers, promotions, etc.)
      await this.processRefundActions(payment);

      return payment;
    } catch (error) {
      logger.error("Refund error:", error);
      throw new ApiError(500, "Failed to process refund");
    }
  }

  async processRefundActions(payment) {
    // Handle refund side effects based on payment type
    switch (payment.type) {
      case "promote_offer":
        // Cancel offer promotion
        if (payment.relatedOffer) {
          payment.relatedOffer.promotion.isPromoted = false;
          await payment.relatedOffer.save();
        }
        break;
      // Add other cases as needed
    }
  }

  getArabicDescription(type) {
    const translations = {
      add_offer: "دفع مقابل إضافة عرض",
      promote_offer: "دفع مقابل ترويج العرض",
      unlock_contact: "دفع مقابل عرض معلومات الاتصال",
      promote_player: "دفع مقابل ترويج اللاعب",
      promote_coach: "دفع مقابل ترويج المدرب",
    };

    return translations[type] || type;
  }
}

// Mock Payment Gateway for testing
class MockPaymentGateway {
  async createCheckout(data) {
    return {
      checkoutId: `mock_checkout_${Date.now()}`,
      checkoutUrl: `https://mock-payment.test/checkout/${data.orderId}`,
    };
  }

  async verifyPayment(checkoutId) {
    // Simulate success for testing
    return {
      success: true,
      transactionId: `mock_txn_${Date.now()}`,
      referenceNumber: `REF${Date.now()}`,
      authCode: "AUTH123",
      paymentMethod: "credit_card",
    };
  }

  async verifyWebhook(data) {
    return true;
  }

  async refundPayment(transactionId, amount) {
    return {
      refundTransactionId: `mock_refund_${Date.now()}`,
    };
  }
}

// Hyperpay Gateway Implementation
class HyperpayGateway {
  constructor() {
    this.baseUrl = process.env.HYPERPAY_BASE_URL;
    this.accessToken = process.env.HYPERPAY_ACCESS_TOKEN;
    this.entityId = process.env.HYPERPAY_ENTITY_ID;
  }

  async createCheckout(data) {
    // Implement Hyperpay checkout creation
    // This is a placeholder - implement according to Hyperpay API docs
    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/checkouts`,
        {
          entityId: this.entityId,
          amount: data.amount.toFixed(2),
          currency: data.currency,
          paymentType: "DB",
          merchantTransactionId: data.orderId,
          customer: {
            email: data.customerEmail,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      return {
        checkoutId: response.data.id,
        checkoutUrl: `${this.baseUrl}/v1/paymentWidgets.js?checkoutId=${response.data.id}`,
      };
    } catch (error) {
      throw new Error(`Hyperpay error: ${error.message}`);
    }
  }

  async verifyPayment(checkoutId) {
    // Implement payment verification
    // Placeholder implementation
    return {
      success: true,
      transactionId: `hp_${Date.now()}`,
      referenceNumber: `REF${Date.now()}`,
      authCode: "AUTH123",
      paymentMethod: "mada",
    };
  }

  async verifyWebhook(data) {
    // Implement webhook verification
    return true;
  }

  async refundPayment(transactionId, amount) {
    // Implement refund
    return {
      refundTransactionId: `hp_refund_${Date.now()}`,
    };
  }
}

export default new PaymentService();
