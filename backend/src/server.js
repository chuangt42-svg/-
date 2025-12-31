import http from "node:http";
import { URL } from "node:url";
import {
  listOrders,
  getOrder,
  createOrder,
  updateOrder,
  createPayment,
  getPayment,
  listPayments,
  listPaymentsForOrder,
  recordPaymentSuccess,
  pricingInfo
} from "./store.js";

const port = Number(process.env.PORT || 4100);

function withCorsHeaders(headers = {}) {
  return {
    ...headers,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, withCorsHeaders({
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body)
  }));
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function isValidOrderStatus(status) {
  return [
    "pending_payment",
    "paid",
    "submitted",
    "completed",
    "refunded"
  ].includes(status);
}

function canTransition(currentStatus, nextStatus) {
  const transitions = {
    pending_payment: ["paid"],
    paid: ["submitted", "refunded"],
    submitted: ["completed", "refunded"],
    completed: [],
    refunded: []
  };

  return transitions[currentStatus]?.includes(nextStatus);
}

function isValidProvider(provider) {
  return ["mock", "stripe", "alipay", "wechat"].includes(provider);
}

function canEditOrder(status) {
  return status === "pending_payment";
}

function matchRoute(method, pathname) {
  const routes = [
    { method: "GET", path: /^\/api\/health$/ },
    { method: "GET", path: /^\/api\/pricing$/ },
    { method: "GET", path: /^\/api\/orders$/ },
    { method: "GET", path: /^\/api\/orders\/(.+)\/payments$/ },
    { method: "GET", path: /^\/api\/orders\/(.+)$/ },
    { method: "POST", path: /^\/api\/orders$/ },
    { method: "PATCH", path: /^\/api\/orders\/(.+)$/ },
    { method: "POST", path: /^\/api\/orders\/(.+)\/pay$/ },
    { method: "POST", path: /^\/api\/orders\/(.+)\/submit$/ },
    { method: "POST", path: /^\/api\/orders\/(.+)\/complete$/ },
    { method: "POST", path: /^\/api\/orders\/(.+)\/refund$/ },
    { method: "GET", path: /^\/api\/payments$/ },
    { method: "GET", path: /^\/api\/payments\/(.+)$/ },
    { method: "POST", path: /^\/api\/payments\/(.+)\/confirm$/ },
    { method: "POST", path: /^\/api\/webhooks\/stripe$/ },
    { method: "POST", path: /^\/api\/webhooks\/alipay$/ },
    { method: "POST", path: /^\/api\/webhooks\/wechat$/ }
  ];

  return routes.find((route) => {
    return route.method === method && route.path.test(pathname);
  });
}

function groupPaymentsByOrder(payments) {
  return payments.reduce((acc, payment) => {
    if (!acc[payment.orderId]) {
      acc[payment.orderId] = [];
    }
    acc[payment.orderId].push(payment);
    return acc;
  }, {});
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { message: "Invalid request" });
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, withCorsHeaders());
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = matchRoute(req.method || "", url.pathname);

  if (!route) {
    sendJson(res, 404, { message: "Not found" });
    return;
  }

  const match = url.pathname.match(route.path);
  const param = match && match[1];

  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      sendJson(res, 200, { status: "ok" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/pricing") {
      sendJson(res, 200, pricingInfo());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/orders") {
      const orders = listOrders();
      if (url.searchParams.get("includePayments") === "true") {
        const paymentsByOrder = groupPaymentsByOrder(listPayments());
        sendJson(res, 200, { orders, paymentsByOrder });
        return;
      }
      sendJson(res, 200, orders);
      return;
    }

    if (req.method === "GET" && param && url.pathname.endsWith("/payments")) {
      const order = getOrder(param);
      if (!order) {
        sendJson(res, 404, { message: "Order not found" });
        return;
      }
      sendJson(res, 200, listPaymentsForOrder(param));
      return;
    }

    if (
      req.method === "GET" &&
      param &&
      url.pathname.startsWith("/api/orders/") &&
      !url.pathname.endsWith("/payments")
    ) {
      const order = getOrder(param);
      if (!order) {
        sendJson(res, 404, { message: "Order not found" });
        return;
      }
      sendJson(res, 200, order);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/orders") {
      const body = await readJsonBody(req);
      const { title, topic, pages } = body;
      const numericPages = Number(pages);
      if (!title || !topic || !numericPages || Number.isNaN(numericPages)) {
        sendJson(res, 400, { message: "title, topic, pages are required" });
        return;
      }
      if (numericPages < 1) {
        sendJson(res, 400, { message: "pages must be greater than 0" });
        return;
      }
      const order = createOrder(body);
      sendJson(res, 201, order);
      return;
    }

    if (req.method === "PATCH" && param && url.pathname.startsWith("/api/orders/")) {
      const body = await readJsonBody(req);
      const current = getOrder(param);
      if (!current) {
        sendJson(res, 404, { message: "Order not found" });
        return;
      }
      const editableKeys = ["title", "topic", "pages", "urgency", "requirements"];
      const hasEditableChanges = editableKeys.some((key) =>
        Object.prototype.hasOwnProperty.call(body, key)
      );
      if (hasEditableChanges && !canEditOrder(current.status)) {
        sendJson(res, 409, { message: "Order cannot be edited in current status" });
        return;
      }
      if (Object.prototype.hasOwnProperty.call(body, "pages")) {
        const numericPages = Number(body.pages);
        if (!numericPages || Number.isNaN(numericPages)) {
          sendJson(res, 400, { message: "pages must be a number" });
          return;
        }
        if (numericPages < 1) {
          sendJson(res, 400, { message: "pages must be greater than 0" });
          return;
        }
      }
      if (body.status) {
        if (!isValidOrderStatus(body.status)) {
          sendJson(res, 400, { message: "Invalid status value" });
          return;
        }
        if (!canTransition(current.status, body.status)) {
          sendJson(res, 409, { message: "Invalid status transition" });
          return;
        }
      }
      const order = updateOrder(param, body);
      sendJson(res, 200, order);
      return;
    }

    if (req.method === "POST" && param && url.pathname.endsWith("/pay")) {
      const body = await readJsonBody(req);
      const order = getOrder(param);
      if (!order) {
        sendJson(res, 404, { message: "Order not found" });
        return;
      }
      if (order.status !== "pending_payment") {
        sendJson(res, 409, { message: "Order cannot be paid in current status" });
        return;
      }
      const provider = body.provider || "mock";
      if (!isValidProvider(provider)) {
        sendJson(res, 400, { message: "Unsupported payment provider" });
        return;
      }
      const payment = createPayment({ orderId: param, provider });
      sendJson(res, 201, {
        payment,
        nextAction:
          provider === "mock"
            ? `POST /api/payments/${payment.id}/confirm`
            : `POST /api/webhooks/${provider}`
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/payments") {
      sendJson(res, 200, listPayments());
      return;
    }

    if (req.method === "GET" && param && url.pathname.startsWith("/api/payments/")) {
      const payment = getPayment(param);
      if (!payment) {
        sendJson(res, 404, { message: "Payment not found" });
        return;
      }
      sendJson(res, 200, payment);
      return;
    }

    if (req.method === "POST" && param && url.pathname.endsWith("/confirm")) {
      const existing = getPayment(param);
      if (!existing) {
        sendJson(res, 404, { message: "Payment not found" });
        return;
      }
      if (existing.status === "succeeded") {
        sendJson(res, 409, { message: "Payment already confirmed" });
        return;
      }
      const payment = recordPaymentSuccess(param);
      sendJson(res, 200, { message: "Payment confirmed", payment });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/webhooks/stripe") {
      const body = await readJsonBody(req);
      if (!body.paymentId) {
        sendJson(res, 400, { message: "paymentId is required" });
        return;
      }
      const payment = recordPaymentSuccess(body.paymentId);
      if (!payment) {
        sendJson(res, 404, { message: "Payment not found" });
        return;
      }
      sendJson(res, 200, { received: true });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/webhooks/alipay") {
      const body = await readJsonBody(req);
      if (!body.paymentId) {
        sendJson(res, 400, { message: "paymentId is required" });
        return;
      }
      const payment = recordPaymentSuccess(body.paymentId);
      if (!payment) {
        sendJson(res, 404, { message: "Payment not found" });
        return;
      }
      sendJson(res, 200, { status: "success" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/webhooks/wechat") {
      const body = await readJsonBody(req);
      if (!body.paymentId) {
        sendJson(res, 400, { message: "paymentId is required" });
        return;
      }
      const payment = recordPaymentSuccess(body.paymentId);
      if (!payment) {
        sendJson(res, 404, { message: "Payment not found" });
        return;
      }
      sendJson(res, 200, { status: "SUCCESS" });
      return;
    }

    if (req.method === "POST" && param && url.pathname.endsWith("/submit")) {
      const body = await readJsonBody(req);
      const current = getOrder(param);
      if (!current) {
        sendJson(res, 404, { message: "Order not found" });
        return;
      }
      if (!canTransition(current.status, "submitted")) {
        sendJson(res, 409, { message: "Order cannot be submitted" });
        return;
      }
      const order = updateOrder(param, {
        status: "submitted",
        deliveryUrl: body.deliveryUrl || ""
      });
      sendJson(res, 200, order);
      return;
    }

    if (req.method === "POST" && param && url.pathname.endsWith("/complete")) {
      const current = getOrder(param);
      if (!current) {
        sendJson(res, 404, { message: "Order not found" });
        return;
      }
      if (!canTransition(current.status, "completed")) {
        sendJson(res, 409, { message: "Order cannot be completed" });
        return;
      }
      const order = updateOrder(param, { status: "completed" });
      sendJson(res, 200, order);
      return;
    }

    if (req.method === "POST" && param && url.pathname.endsWith("/refund")) {
      const current = getOrder(param);
      if (!current) {
        sendJson(res, 404, { message: "Order not found" });
        return;
      }
      if (!canTransition(current.status, "refunded")) {
        sendJson(res, 409, { message: "Order cannot be refunded" });
        return;
      }
      updateOrder(param, { status: "refunded" });
      sendJson(res, 200, { message: "Refund initiated" });
      return;
    }

    sendJson(res, 404, { message: "Not found" });
  } catch (error) {
    sendJson(res, 400, { message: "Invalid JSON payload" });
  }
});

server.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`);
});
