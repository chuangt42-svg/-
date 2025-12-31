const API_BASE = "http://localhost:4000/api";

const orderForm = document.getElementById("order-form");
const ordersContainer = document.getElementById("orders");
const pricingContainer = document.getElementById("pricing");
const orderError = document.getElementById("order-error");
const orderLoading = document.getElementById("order-loading");
const summaryCards = document.getElementById("summary-cards");

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || "请求失败");
  }
  return response.json();
}

function setError(message) {
  if (!message) {
    orderError.style.display = "none";
    orderError.textContent = "";
    return;
  }
  orderError.classList.add("error");
  orderError.textContent = message;
  orderError.style.display = "block";
}

function setLoading(isLoading) {
  orderLoading.style.display = isLoading ? "block" : "none";
}

const statusLabels = {
  pending_payment: "待支付",
  paid: "已支付",
  submitted: "已提交",
  completed: "已完成",
  refunded: "已退款"
};

const statusBadgeClass = {
  pending_payment: "warning",
  paid: "success",
  submitted: "info",
  completed: "success",
  refunded: "warning"
};

function formatStatus(status) {
  return statusLabels[status] || status;
}

function renderPricing(pricing) {
  if (!pricing) return;
  const { rules } = pricing;
  pricingContainer.innerHTML = `
    <div class="card">
      <h3>基础价格</h3>
      <p>每页 ¥${rules.basePricePerPage}</p>
    </div>
    <div class="card">
      <h3>紧急系数</h3>
      <p>正常：${rules.urgencyMultiplier.normal}</p>
      <p>加急：${rules.urgencyMultiplier.urgent}</p>
      <p>极速：${rules.urgencyMultiplier.express}</p>
    </div>
  `;
}

function renderSummary(orders, paymentsByOrder) {
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);
  const pending = orders.filter((order) => order.status === "pending_payment").length;
  const paid = orders.filter((order) => order.status === "paid").length;
  const latestPayment = Object.values(paymentsByOrder)
    .flat()
    .slice(-1)[0];

  summaryCards.innerHTML = `
    <div class="summary-card">
      <h3>订单总数</h3>
      <p>${totalOrders} 单</p>
    </div>
    <div class="summary-card">
      <h3>累计金额</h3>
      <p>¥${totalRevenue}</p>
    </div>
    <div class="summary-card">
      <h3>待支付</h3>
      <p>${pending} 单</p>
    </div>
    <div class="summary-card">
      <h3>已支付</h3>
      <p>${paid} 单</p>
    </div>
    <div class="summary-card">
      <h3>最近支付</h3>
      <p>${latestPayment ? `${latestPayment.provider} / ${latestPayment.status}` : "暂无"}</p>
    </div>
  `;
}

function renderOrders(orders, payments) {
  ordersContainer.innerHTML = "";
  if (!orders.length) {
    ordersContainer.innerHTML = "<p class=\"muted\">暂无订单。</p>";
    return;
  }
  orders.forEach((order) => {
    const orderPayments = payments[order.id] || [];
    const latestPayment = orderPayments[orderPayments.length - 1];
    const canPay = order.status === "pending_payment";
    const canSubmit = order.status === "paid";
    const canComplete = order.status === "submitted";
    const card = document.createElement("div");
    card.className = "order-card";
    card.innerHTML = `
      <h3>${order.title}</h3>
      <div class="order-meta">
        <span>主题：${order.topic}</span>
        <span>金额：¥${order.amount}（${order.pages}页，${order.urgency}）</span>
        <span>创建时间：${new Date(order.createdAt).toLocaleString()}</span>
      </div>
      <div class="inline-row">
        <span class="badge ${statusBadgeClass[order.status] || ""}">
          状态：${formatStatus(order.status)}
        </span>
        <span class="muted">
          最近支付：${latestPayment ? `${latestPayment.provider} / ${latestPayment.status}` : "暂无"}
        </span>
      </div>
      <div class="actions">
        <button data-action="pay" data-id="${order.id}" data-provider="${latestPayment?.provider || "mock"}" ${canPay ? "" : "disabled"}>创建支付</button>
        <button class="secondary" data-action="submit" data-id="${order.id}" ${canSubmit ? "" : "disabled"}>提交稿件</button>
        <button class="secondary" data-action="complete" data-id="${order.id}" ${canComplete ? "" : "disabled"}>完成订单</button>
      </div>
    `;
    ordersContainer.appendChild(card);
  });
}

async function loadOrders() {
  setLoading(true);
  try {
    const response = await fetchJson(`${API_BASE}/orders?includePayments=true`);
    const orders = response.orders || [];
    const paymentsByOrder = response.paymentsByOrder || {};
    renderOrders(orders, paymentsByOrder);
    renderSummary(orders, paymentsByOrder);
  } finally {
    setLoading(false);
  }
}

async function loadPricing() {
  const pricing = await fetchJson(`${API_BASE}/pricing`);
  renderPricing(pricing);
}

orderForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(orderForm);
  const payload = Object.fromEntries(formData.entries());
  payload.pages = Number(payload.pages);
  setError("");
  if (!payload.title || !payload.topic) {
    setError("请填写订单标题与论文主题。");
    return;
  }
  if (!payload.pages || Number.isNaN(payload.pages) || payload.pages < 1) {
    setError("页数必须为大于 0 的数字。");
    return;
  }
  try {
    await fetchJson(`${API_BASE}/orders`, {
      method: "POST",
      body: JSON.stringify(payload)
    });
    orderForm.reset();
    await loadOrders();
  } catch (error) {
    setError(error.message);
  }
});

ordersContainer.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const id = button.dataset.id;
  const action = button.dataset.action;
  setError("");
  try {
    if (action === "pay") {
      const provider = document.getElementById("provider").value;
      const result = await fetchJson(`${API_BASE}/orders/${id}/pay`, {
        method: "POST",
        body: JSON.stringify({ provider })
      });
      await fetchJson(`${API_BASE}/payments/${result.payment.id}/confirm`, {
        method: "POST"
      });
    }
    if (action === "submit") {
      await fetchJson(`${API_BASE}/orders/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ deliveryUrl: "https://example.com/deliveries/demo" })
      });
    }
    if (action === "complete") {
      await fetchJson(`${API_BASE}/orders/${id}/complete`, { method: "POST" });
    }
    await loadOrders();
  } catch (error) {
    setError(error.message);
  }
});

loadOrders();
loadPricing();
