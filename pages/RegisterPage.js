const registerForm = document.getElementById("registerForm");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const confirmPasswordInput = document.getElementById("confirmPassword");
const registerButton = document.getElementById("registerButton");
const registerSpinner = document.getElementById("registerSpinner");
const buttonText = document.getElementById("buttonText");
const toastContainer = document.getElementById("toastContainer");

const nameError = document.getElementById("nameError");
const emailError = document.getElementById("emailError");
const passwordError = document.getElementById("passwordError");
const confirmPasswordError = document.getElementById("confirmPasswordError");

const ruleLength = document.getElementById("rule-length");
const ruleUppercase = document.getElementById("rule-uppercase");
const ruleLowercase = document.getElementById("rule-lowercase");
const ruleNumber = document.getElementById("rule-number");
const ruleSpecial = document.getElementById("rule-special");

/* =========================
   Initialize
========================= */

function initializeRegisterPage() {
  registerForm.addEventListener("submit", handleSubmit);
  setupLoginLink();
  setupPasswordToggle();
  setupPasswordValidation();
}

/* =========================
   Password Rules
========================= */

function getPasswordChecks(password) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
}

function updatePasswordChecklist() {
  const password = passwordInput.value;
  const checks = getPasswordChecks(password);

  toggleRule(ruleLength, checks.length);
  toggleRule(ruleUppercase, checks.uppercase);
  toggleRule(ruleLowercase, checks.lowercase);
  toggleRule(ruleNumber, checks.number);
  toggleRule(ruleSpecial, checks.special);
}

function toggleRule(element, isValid) {
  if (!element) return;

  if (isValid) {
    element.classList.add("valid");
  } else {
    element.classList.remove("valid");
  }
}

function setupPasswordValidation() {
  passwordInput.addEventListener("input", updatePasswordChecklist);
  updatePasswordChecklist();
}

/* =========================
   Password Eye Toggle
========================= */

function setupPasswordToggle() {
  const toggleButtons = document.querySelectorAll(".password-toggle");

  toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-target");
      const input = document.getElementById(targetId);

      if (!input) return;

      const isHiddenNow = input.type === "password";
      input.type = isHiddenNow ? "text" : "password";

      button.setAttribute(
        "aria-label",
        isHiddenNow ? "Hide password" : "Show password"
      );

      updatePasswordToggleIcon(button, isHiddenNow);
    });
  });
}

function updatePasswordToggleIcon(button, isVisible) {
  const hiddenIcon = button.querySelector(".password-icon-hidden");
  const visibleIcon = button.querySelector(".password-icon-visible");

  if (!hiddenIcon || !visibleIcon) return;

  if (isVisible) {
    hiddenIcon.classList.add("hidden");
    visibleIcon.classList.remove("hidden");
  } else {
    hiddenIcon.classList.remove("hidden");
    visibleIcon.classList.add("hidden");
  }
}

/* =========================
   Validation
========================= */

function validateForm() {
  const errors = {
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  };

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  const checks = getPasswordChecks(password);

  if (!name) {
    errors.name = "Full name is required";
  }

  if (!email) {
    errors.email = "Email is required";
  } else if (!isValidEmail(email)) {
    errors.email = "Invalid email format";
  }

  if (!password) {
    errors.password = "Password is required";
  } else if (
    !checks.length ||
    !checks.uppercase ||
    !checks.lowercase ||
    !checks.number ||
    !checks.special
  ) {
    errors.password = "Password does not meet the required conditions";
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Please confirm your password";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  setFieldErrors(errors);

  return !errors.name && !errors.email && !errors.password && !errors.confirmPassword;
}

function isValidEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

function setFieldErrors(errors) {
  setError(nameError, errors.name);
  setError(emailError, errors.email);
  setError(passwordError, errors.password);
  setError(confirmPasswordError, errors.confirmPassword);
}

function setError(fieldElement, message) {
  if (!fieldElement) return;

  fieldElement.textContent = message;

  if (message) {
    fieldElement.classList.remove("hidden");
  } else {
    fieldElement.classList.add("hidden");
  }
}

/* =========================
   Submit Register
========================= */

async function handleSubmit(event) {
  event.preventDefault();

  if (!validateForm()) {
    return;
  }

  setLoading(true);

  try {
    await window.CommentInsightFirebase.registerUser(
      nameInput.value.trim(),
      emailInput.value.trim(),
      passwordInput.value
    );

    setLoading(false);
    showToast("Account created successfully!", "success");

    setTimeout(() => {
      window.location.href = "/analyze";
    }, 1000);
  } catch (error) {
    setLoading(false);
    showToast(getFirebaseErrorMessage(error), "error");
  }
}

/* =========================
   Navigation
========================= */

function setupLoginLink() {
  const loginLink = document.querySelector(
    '.form-footer a[href="/login"], .form-footer a[href="/login"]'
  );

  if (!loginLink) return;

  loginLink.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = "/login";
  });
}

/* =========================
   Loading State
========================= */

function setLoading(isLoading) {
  registerButton.disabled = isLoading;

  if (isLoading) {
    registerSpinner.classList.remove("hidden");
    buttonText.textContent = "Creating account...";
  } else {
    registerSpinner.classList.add("hidden");
    buttonText.textContent = "Create Account";
  }
}

/* =========================
   Firebase Error Messages
========================= */

function getFirebaseErrorMessage(error) {
  const code = error && error.code;

  if (code === "auth/email-already-in-use") {
    return "This email is already registered";
  }

  if (code === "auth/invalid-email") {
    return "Invalid email format";
  }

  if (code === "auth/weak-password") {
    return "Password is too weak";
  }

  return (error && error.message) || "Registration failed. Please try again.";
}

/* =========================
   Toast
========================= */

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

/* =========================
   Accessibility
========================= */

function setupAccessibility() {
  registerForm.setAttribute("aria-live", "polite");
}

/* =========================
   Start Page
========================= */

function initialize() {
  initializeRegisterPage();
  setupAccessibility();
}

document.addEventListener("DOMContentLoaded", initialize);

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    validateForm,
    setFieldErrors,
    setLoading,
    showToast,
  };
}