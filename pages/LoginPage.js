/**
 * LoginPage - Standalone login page script
 */

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("errorMessage");
const loginButton = document.getElementById("loginButton");
const loginSpinner = document.getElementById("loginSpinner");
const loginText = document.getElementById("loginText");
const forgotPasswordButton = document.getElementById("forgotPassword");
const toastContainer = document.getElementById("toastContainer");
const togglePasswordButton = document.getElementById("togglePassword");
const passwordIconHidden = document.getElementById("passwordIconHidden");
const passwordIconVisible = document.getElementById("passwordIconVisible");

/**
 * Initialize page listeners
 */
function initializeLoginPage() {
  loginForm.addEventListener("submit", handleSubmit);
  forgotPasswordButton.addEventListener("click", handleForgotPassword);
  setupRegisterLink();
  setupPasswordToggle();
}

/**
 * Handle login form submission
 */
async function handleSubmit(event) {
  event.preventDefault();
  hideError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError("Please fill in all fields");
    return;
  }

  if (!isValidEmail(email)) {
    showError("Invalid email format");
    return;
  }

  setLoading(true);

  try {
    await window.CommentInsightFirebase.loginUser(email, password);
    setLoading(false);
    showToast("Welcome back!", "success");

    setTimeout(() => {
      window.location.href = "/analyze";
    }, 1000);
  } catch (error) {
    showError(getFirebaseErrorMessage(error));
    setLoading(false);
  }
}

/**
 * Handle forgot password click
 */
async function handleForgotPassword() {
  const email = emailInput.value.trim();

  hideError();

  if (!email) {
    showError("Enter your email first, then click forgot password.");
    return;
  }

  if (!isValidEmail(email)) {
    showError("Invalid email format");
    return;
  }

  try {
    await window.CommentInsightFirebase.sendPasswordReset(email);
    showToast("Password reset email sent", "success");
  } catch (error) {
    showError(getFirebaseErrorMessage(error));
  }
}

/**
 * Setup register link navigation
 */
function setupRegisterLink() {
  const registerLink = document.querySelector(
    '.form-footer a[href="/register"], .form-footer a[href="/register"]'
  );

  if (!registerLink) return;

  registerLink.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = "/register";
  });
}

/**
 * Password visibility toggle
 */
function setupPasswordToggle() {
  if (!togglePasswordButton) return;

  togglePasswordButton.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";

    passwordInput.type = isHidden ? "text" : "password";

    togglePasswordButton.setAttribute(
      "aria-label",
      isHidden ? "Hide password" : "Show password"
    );

    if (passwordIconHidden && passwordIconVisible) {
      passwordIconHidden.classList.toggle("hidden", isHidden);
      passwordIconVisible.classList.toggle("hidden", !isHidden);
    }
  });
}

/**
 * Email format validation
 */
function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

/**
 * Show error message
 */
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.classList.remove("hidden");
}

/**
 * Hide error message
 */
function hideError() {
  errorMessage.textContent = "";
  errorMessage.classList.add("hidden");
}

/**
 * Toggle loading state
 */
function setLoading(isLoading) {
  loginButton.disabled = isLoading;

  if (isLoading) {
    loginSpinner.classList.remove("hidden");
    loginText.textContent = "Logging in...";
  } else {
    loginSpinner.classList.add("hidden");
    loginText.textContent = "Login";
  }
}

/**
 * Convert Firebase error into user-friendly message
 */
function getFirebaseErrorMessage(error) {
  const code = error && error.code;

  if (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  ) {
    return "Incorrect email or password";
  }

  if (code === "auth/invalid-email") {
    return "Invalid email format";
  }

  if (code === "auth/too-many-requests") {
    return "Too many attempts. Please try again later.";
  }

  return error.message || "Login failed. Please try again.";
}

/**
 * Show toast notification
 */
function showToast(message, type = "info") {
  const toast = document.createElement("div");

  toast.className = `toast ${type}`;
  toast.setAttribute("role", "status");
  toast.textContent = message;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-exit");
  }, 2600);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/**
 * Initialize once DOM is loaded
 */
document.addEventListener("DOMContentLoaded", initializeLoginPage);

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    initializeLoginPage,
    handleSubmit,
    handleForgotPassword,
    showError,
    hideError,
    showToast,
    setLoading,
  };
}