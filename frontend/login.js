const loginError = document.getElementById("login-error");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginSubmit = document.getElementById("login-submit");

function showError(message) {
  loginError.textContent = message;
  loginError.style.display = "block";
}

function clearError() {
  loginError.textContent = "";
  loginError.style.display = "none";
}

loginSubmit.addEventListener("click", () => {
  clearError();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) {
    showError("请输入邮箱和密码。");
    return;
  }
  if (!email.includes("@")) {
    showError("请输入有效的邮箱地址。");
    return;
  }
  window.location.href = "./index.html";
});
