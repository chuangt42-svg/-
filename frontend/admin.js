const API_BASE = "http://localhost:4000/api";
const tableBody = document.getElementById("order-table");
const searchInput = document.getElementById("search");
const statusFilter = document.getElementById("status-filter");
const refreshButton = document.getElementById("refresh");

function formatCurrency(amount) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0
  }).format(amount);
}

function formatStatus(status) {
  const map = {
    pending_payment: "待支付",
    paid: "已支付",
    submitted: "已提交",
    completed: "已完成",
    refunded: "已退款"
  };
  return map[status] || status;
}

async function fetchOrders() {
  const response = await fetch(`${API_BASE}/orders`);
  if (!response.ok) {
    throw new Error("加载订单失败");
  }
  return response.json();
}

function renderOrders(orders) {
  tableBody.innerHTML = "";
  if (!orders.length) {
    tableBody.innerHTML = "<tr><td colspan=\"5\">暂无订单</td></tr>";
    return;
  }
  orders.forEach((order) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${order.title}</td>
      <td>${order.topic}</td>
      <td>${formatCurrency(order.amount)}</td>
      <td><span class="badge">${formatStatus(order.status)}</span></td>
      <td>
        <div class="actions">
          <button class="secondary" data-action="view" data-id="${order.id}">查看</button>
          <button data-action="complete" data-id="${order.id}">完成</button>
        </div>
      </td>
    `;
    tableBody.appendChild(row);
  });
}

function applyFilters(orders) {
  const query = searchInput.value.trim();
  const status = statusFilter.value;
  return orders.filter((order) => {
    const matchesText =
      !query ||
      order.title.includes(query) ||
      order.topic.includes(query);
    const matchesStatus = !status || order.status === status;
    return matchesText && matchesStatus;
  });
}

async function loadOrders() {
  try {
    const orders = await fetchOrders();
    renderOrders(applyFilters(orders));
  } catch (error) {
    tableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
  }
}

refreshButton.addEventListener("click", loadOrders);
searchInput.addEventListener("input", loadOrders);
statusFilter.addEventListener("change", loadOrders);

loadOrders();
