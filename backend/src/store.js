import { randomUUID } from "node:crypto";

const orders = new Map();
const payments = new Map();

const nowIso = () => new Date().toISOString();

const pricingRules = {
  basePricePerPage: 50,
  urgencyMultiplier: {
    normal: 1,
    urgent: 1.3,
    express: 1.6
  }
};

const generateId = () => randomUUID();

export function listOrders() {
  return Array.from(orders.values());
}

export function getOrder(id) {
  return orders.get(id);
}

export function createOrder(payload) {
  const pages = Number(payload.pages || 1);
  const urgency = payload.urgency || "normal";
  const multiplier = pricingRules.urgencyMultiplier[urgency] ?? 1;
  const amount = Math.round(pages * pricingRules.basePricePerPage * multiplier);
  const order = {
    id: generateId(),
    title: payload.title,
    topic: payload.topic,
    pages,
    urgency,
    requirements: payload.requirements || "",
    amount,
    currency: "CNY",
    status: "pending_payment",
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  orders.set(order.id, order);
  return order;
}

export function updateOrder(id, updates) {
  const order = orders.get(id);
  if (!order) return null;
  const next = {
    ...order,
    ...updates,
    updatedAt: nowIso()
  };
  orders.set(id, next);
  return next;
}

export function createPayment({ orderId, provider }) {
  const order = orders.get(orderId);
  if (!order) return null;
  const payment = {
    id: generateId(),
    orderId,
    provider,
    amount: order.amount,
    currency: order.currency,
    status: "pending",
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  payments.set(payment.id, payment);
  return payment;
}

export function getPayment(id) {
  return payments.get(id);
}

export function updatePayment(id, updates) {
  const payment = payments.get(id);
  if (!payment) return null;
  const next = {
    ...payment,
    ...updates,
    updatedAt: nowIso()
  };
  payments.set(id, next);
  return next;
}

export function listPayments() {
  return Array.from(payments.values());
}

export function recordPaymentSuccess(paymentId) {
  const payment = payments.get(paymentId);
  if (!payment) return null;
  const updatedPayment = updatePayment(paymentId, { status: "succeeded" });
  updateOrder(payment.orderId, { status: "paid" });
  return updatedPayment;
}

export function pricingInfo() {
  return {
    rules: pricingRules,
    currency: "CNY"
  };
}
