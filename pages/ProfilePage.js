/**
 * ProfilePage - standalone profile settings page script
 */

const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const saveNameBtn = document.getElementById("saveNameBtn");
const saveNameSpinner = document.getElementById("saveNameSpinner");

const currentPasswordInput = document.getElementById("currentPassword");
const newPasswordInput = document.getElementById("newPassword");
const confirmPasswordInput = document.getElementById("confirmPassword");
const updatePasswordBtn = document.getElementById("updatePasswordBtn");
const passwordSpinner = document.getElementById("passwordSpinner");

const toastContainer = document.getElementById("toastContainer");

const profileRuleLength = document.getElementById("profile-rule-length");
const profileRuleUppercase = document.getElementById("profile-rule-uppercase");
const profileRuleLowercase = document.getElementById("profile-rule-lowercase");
const profileRuleNumber = document.getElementById("profile-rule-number");
const profileRuleSpecial = document.getElementById("profile-rule-special");

const mockUser = {
  name: "John Doe",
  email: "john@example.com",
};

/* =========================
   Initialize
========================= */

function initializeProfilePage() {
  loadFirebaseProfile();

  saveNameBtn.addEventListener("click", handleSaveName);
  updatePasswordBtn.addEventListener("click", handleUpdatePassword);

  setupReadonlyPasswordInputs();
  setupPasswordToggle();
  setupPasswordValidation();
}

/* =========================
   Load Profile
========================= */

async function loadFirebaseProfile() {
  setProfileInfoLoading(true);

  if (!window.CommentInsightFirebase) {
    nameInput.value = mockUser.name;
    emailInput.value = mockUser.email;
    setProfileInfoLoading(false);
    return;
  }

  try {
    const profile = await window.CommentInsightFirebase.getUserProfile();
    nameInput.value = profile.name || "";
    emailInput.value = profile.email || "";
  } catch (error) {
    showToast(error.message || "Unable to load profile from Firebase", "error");
  } finally {
    setProfileInfoLoading(false);
  }
}

function setProfileInfoLoading(isLoading) {
  if (isLoading) {
    nameInput.value = "";
    emailInput.value = "";
    nameInput.placeholder = "Loading full name...";
    emailInput.placeholder = "Loading email address...";
    nameInput.disabled = true;
    saveNameBtn.disabled = true;
    return;
  }

  nameInput.placeholder = "Enter your name";
  emailInput.placeholder = "Email address";

  nameInput.disabled = false;
  saveNameBtn.disabled = false;
}

/* =========================
   Save Name
========================= */

async function handleSaveName() {
  const name = nameInput.value.trim();

  if (!name) {
    showToast("Name cannot be empty", "error");
    return;
  }

  setSaveNameLoading(true);

  try {
    await window.CommentInsightFirebase.updateUserName(name);
    setSaveNameLoading(false);
    showToast("Name updated successfully", "success");
  } catch (error) {
    setSaveNameLoading(false);
    showToast(error.message || "Unable to update name", "error");
  }
}

/* =========================
   Password Readonly Handling
========================= */

function setupReadonlyPasswordInputs() {
  [newPasswordInput, confirmPasswordInput].forEach((input) => {
    if (!input) return;

    input.addEventListener("focus", () => {
      input.removeAttribute("readonly");
    });
  });
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

function isPasswordStrong(password) {
  const checks = getPasswordChecks(password);

  return (
    checks.length &&
    checks.uppercase &&
    checks.lowercase &&
    checks.number &&
    checks.special
  );
}

function setupPasswordValidation() {
  newPasswordInput.addEventListener("input", updatePasswordChecklist);
  updatePasswordChecklist();
}

function updatePasswordChecklist() {
  const checks = getPasswordChecks(newPasswordInput.value);

  toggleRule(profileRuleLength, checks.length);
  toggleRule(profileRuleUppercase, checks.uppercase);
  toggleRule(profileRuleLowercase, checks.lowercase);
  toggleRule(profileRuleNumber, checks.number);
  toggleRule(profileRuleSpecial, checks.special);
}

function toggleRule(ruleElement, isValid) {
  if (!ruleElement) return;

  if (isValid) {
    ruleElement.classList.add("valid");
  } else {
    ruleElement.classList.remove("valid");
  }
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
   Update Password
========================= */

async function handleUpdatePassword() {
  const currentPassword = currentPasswordInput.value;
  const newPassword = newPasswordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  if (!currentPassword || !newPassword || !confirmPassword) {
    showToast("Please fill in all password fields", "error");
    return;
  }

  if (!isPasswordStrong(newPassword)) {
    showToast("New password does not meet all required conditions", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast("New passwords do not match", "error");
    return;
  }

  setUpdatePasswordLoading(true);

  try {
    await window.CommentInsightFirebase.updateUserPassword(
      currentPassword,
      newPassword
    );

    setUpdatePasswordLoading(false);

    currentPasswordInput.value = "";
    newPasswordInput.value = "";
    confirmPasswordInput.value = "";
    updatePasswordChecklist();

    resetPasswordFieldsToHidden();

    showToast("Password updated successfully", "success");
  } catch (error) {
    setUpdatePasswordLoading(false);
    showToast(getFirebaseErrorMessage(error), "error");
  }
}

function resetPasswordFieldsToHidden() {
  const passwordFields = [
    currentPasswordInput,
    newPasswordInput,
    confirmPasswordInput,
  ];

  passwordFields.forEach((input) => {
    input.type = "password";
  });

  document.querySelectorAll(".password-toggle").forEach((button) => {
    button.setAttribute("aria-label", "Show password");
    updatePasswordToggleIcon(button, false);
  });
}

/* =========================
   Logout
========================= */

async function handleLogout() {
  try {
    if (window.CommentInsightFirebase) {
      await window.CommentInsightFirebase.logoutUser();
    }

    showToast("Logged out successfully", "info");

    setTimeout(() => {
      window.location.href = "/";
    }, 1000);
  } catch (error) {
    showToast(error.message || "Logout failed", "error");
  }
}

/* =========================
   Loading States
========================= */

function setSaveNameLoading(isLoading) {
  saveNameBtn.disabled = isLoading;

  if (isLoading) {
    saveNameSpinner.classList.remove("hidden");
  } else {
    saveNameSpinner.classList.add("hidden");
  }
}

function setUpdatePasswordLoading(isLoading) {
  updatePasswordBtn.disabled = isLoading;

  if (isLoading) {
    passwordSpinner.classList.remove("hidden");
  } else {
    passwordSpinner.classList.add("hidden");
  }
}

/* =========================
   Firebase Error Messages
========================= */

function getFirebaseErrorMessage(error) {
  const code = error && error.code;

  if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
    return "Current password is incorrect";
  }

  if (code === "auth/requires-recent-login") {
    return "Please log in again before updating your password";
  }

  if (code === "auth/weak-password") {
    return "New password is too weak";
  }

  return error.message || "Unable to update password";
}

/* =========================
   Toast Notification
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
   Accessibility + Keyboard
========================= */

function setupAccessibility() {
  [saveNameBtn, updatePasswordBtn].forEach((button) => {
    button.setAttribute("aria-live", "polite");
  });
}

function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && document.activeElement.tagName === "INPUT") {
      event.preventDefault();

      if (document.activeElement.id === "name") {
        handleSaveName();
      } else {
        handleUpdatePassword();
      }
    }
  });
}

/* =========================
   Start Page
========================= */

document.addEventListener("DOMContentLoaded", function () {
  initializeProfilePage();

  if (window.CommentInsightNavbar) {
    window.CommentInsightNavbar.init("/profile", { onLogout: handleLogout });
  }

  setupAccessibility();
  setupKeyboardShortcuts();
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    initializeProfilePage,
    handleSaveName,
    handleUpdatePassword,
    showToast,
    setSaveNameLoading,
    setUpdatePasswordLoading,
  };
}