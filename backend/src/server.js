import express from "express";
import cors from "cors";
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  createPayment,
  getPayment,
  updatePayment,
  listPayments,
  recordPaymentSuccess,
  pricingInfo
} from "./store.js";

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/pricing", (_req, res) => {
  res.json(pricingInfo());
});

app.get("/api/orders", (_req, res) => {
  res.json(listOrders());
});

app.get("/api/orders/:id", (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  res.json(order);
});

app.post("/api/orders", (req, res) => {
  const { title, topic, pages } = req.body;
  if (!title || !topic || !pages) {
    res.status(400).json({ message: "title, topic, pages are required" });
    return;
  }
  const order = createOrder(req.body);
  res.status(201).json(order);
});

app.patch("/api/orders/:id", (req, res) => {
  const order = updateOrder(req.params.id, req.body);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  res.json(order);
});

app.post("/api/orders/:id/pay", (req, res) => {
  const provider = req.body.provider || "mock";
  const payment = createPayment({ orderId: req.params.id, provider });
  if (!payment) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  res.status(201).json({
    payment,
    nextAction:
      provider === "mock"
        ? `POST /api/payments/${payment.id}/confirm`
        : `POST /api/webhooks/${provider}`
  });
});

app.get("/api/payments", (_req, res) => {
  res.json(listPayments());
});

app.get("/api/payments/:id", (req, res) => {
  const payment = getPayment(req.params.id);
  if (!payment) {
    res.status(404).json({ message: "Payment not found" });
    return;
  }
  res.json(payment);
});

app.post("/api/payments/:id/confirm", (req, res) => {
  const payment = recordPaymentSuccess(req.params.id);
  if (!payment) {
    res.status(404).json({ message: "Payment not found" });
    return;
  }
  res.json({ message: "Payment confirmed", payment });
});

app.post("/api/webhooks/stripe", (req, res) => {
  const { paymentId } = req.body;
  if (!paymentId) {
    res.status(400).json({ message: "paymentId is required" });
    return;
  }
  const payment = recordPaymentSuccess(paymentId);
  if (!payment) {
    res.status(404).json({ message: "Payment not found" });
    return;
  }
  res.json({ received: true });
});

app.post("/api/webhooks/alipay", (req, res) => {
  const { paymentId } = req.body;
  const payment = paymentId ? recordPaymentSuccess(paymentId) : null;
  if (!payment) {
    res.status(400).json({ message: "paymentId is required" });
    return;
  }
  res.json({ status: "success" });
});

app.post("/api/webhooks/wechat", (req, res) => {
  const { paymentId } = req.body;
  const payment = paymentId ? recordPaymentSuccess(paymentId) : null;
  if (!payment) {
    res.status(400).json({ message: "paymentId is required" });
    return;
  }
  res.json({ status: "SUCCESS" });
});

app.post("/api/orders/:id/submit", (req, res) => {
  const order = updateOrder(req.params.id, {
    status: "submitted",
    deliveryUrl: req.body.deliveryUrl || ""
  });
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  res.json(order);
});

app.post("/api/orders/:id/complete", (req, res) => {
  const order = updateOrder(req.params.id, { status: "completed" });
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  res.json(order);
});

app.post("/api/orders/:id/refund", (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) {
    res.status(404).json({ message: "Order not found" });
    return;
  }
  updateOrder(req.params.id, { status: "refunded" });
  res.json({ message: "Refund initiated" });
});

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
