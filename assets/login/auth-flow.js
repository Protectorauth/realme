window.RealMeAuth = (function () {
    var STORAGE = {
        pendingToken: "realme_pending_token",
        username: "realme_username",
        sessionToken: "realme_session_token"
    };

    async function apiRequest(url, body) {
        var response = await fetch(window.RealMeAPI.url(url), {
            method: "POST",
            credentials: window.RealMeAPI.credentials(),
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        var data = {};
        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            throw new Error(data.error || "Request failed.");
        }

        return data;
    }

    function bindLoginForm(formId, options) {
        var form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener("submit", async function (event) {
            event.preventDefault();
            var usernameInput = form.querySelector("#signInName");
            var passwordInput = form.querySelector("#password");
            var errorBox = document.getElementById("loginApiError");
            if (errorBox) {
                errorBox.style.display = "none";
                errorBox.textContent = "";
            }

            try {
                var result = await apiRequest("/api/auth/login", {
                    username: usernameInput.value.trim(),
                    password: passwordInput.value
                });
                sessionStorage.setItem(STORAGE.pendingToken, result.pending_token);
                sessionStorage.setItem(STORAGE.username, result.username);
                window.location.href = options.authCodeUrl;
            } catch (err) {
                if (errorBox) {
                    errorBox.textContent = err.message;
                    errorBox.style.display = "block";
                }
            }
        });
    }

    function showVerifyingModal() {
        var modal = document.querySelector("#attributeVerification > .verifying-modal");
        if (modal) {
            modal.classList.add("is-visible");
            modal.setAttribute("aria-hidden", "false");
        }
        document.body.classList.add("processing-active");
    }

    function hideVerifyingModal() {
        var modal = document.querySelector("#attributeVerification > .verifying-modal");
        if (modal) {
            modal.classList.remove("is-visible");
            modal.setAttribute("aria-hidden", "true");
        }
        document.body.classList.remove("processing-active");
    }

    function schedulePostVerificationRedirect(manageUrl, delayMs) {
        window.setTimeout(function () {
            showVerifyingModal();
            window.setTimeout(function () {
                window.location.replace(manageUrl);
            }, 1500);
        }, delayMs || 800);
    }

    function bindAuthCodePage(options) {
        var pendingToken = sessionStorage.getItem(STORAGE.pendingToken);
        var username = sessionStorage.getItem(STORAGE.username);
        if (!pendingToken || !username) {
            window.location.href = options.loginUrl;
            return;
        }

        var codeInput = document.getElementById("verificationCode");
        var verifyBtn = document.getElementById("mfaValidationControl_but_verify_code");
        var changeBtn = document.getElementById("mfaValidationControl_but_change_claims");
        var continueBtn = document.getElementById("continue");
        var successMessage = document.getElementById("mfaValidationControl_success_message");
        var securityCheckError = document.getElementById("securityCheckError");
        var invalidCodeError = document.getElementById("mfaValidationControl_error_message");
        var invalidCodeErrorWrap = invalidCodeError ? invalidCodeError.parentElement : null;
        var requiredFieldMissing = document.getElementById("requiredFieldMissing");
        var codeFieldError = document.querySelector(".verificationCode_li .error.itemLevel");
        var workingIndicator = document.querySelector("#mfaValidationControl > .working");
        var verifiedSession = null;
        var isFinishing = false;

        function showWorking() {
            if (workingIndicator) {
                workingIndicator.setAttribute("aria-hidden", "false");
            }
        }

        function hideWorking() {
            if (workingIndicator) {
                workingIndicator.setAttribute("aria-hidden", "true");
            }
        }

        function showSuccessMessage(text) {
            if (!successMessage) {
                return;
            }
            successMessage.textContent = text;
            successMessage.style.display = "inline";
            successMessage.setAttribute("aria-hidden", "false");
            successMessage.setAttribute("aria-label", text);
        }

        function hideSuccessMessage() {
            if (!successMessage) {
                return;
            }
            successMessage.style.display = "none";
            successMessage.setAttribute("aria-hidden", "true");
        }

        function hideRequiredFieldMissing() {
            if (!requiredFieldMissing) {
                return;
            }
            requiredFieldMissing.style.display = "none";
            requiredFieldMissing.setAttribute("aria-hidden", "true");
        }

        function showCodeRequiredError() {
            hideInvalidCodeError();
            hideRequiredFieldMissing();
            if (codeFieldError) {
                codeFieldError.textContent = "Confirmation Code is required.";
                codeFieldError.classList.add("show");
                codeFieldError.setAttribute("aria-hidden", "false");
                codeFieldError.setAttribute("aria-label", "");
            }
        }

        function hideCodeRequiredError() {
            if (codeFieldError) {
                codeFieldError.textContent = "";
                codeFieldError.classList.remove("show");
                codeFieldError.setAttribute("aria-hidden", "true");
                codeFieldError.setAttribute("aria-label", "");
            }
        }

        function hideSecurityCheckError() {
            if (securityCheckError) {
                securityCheckError.textContent = "";
                securityCheckError.hidden = true;
            }
        }

        function hideInvalidCodeError() {
            if (invalidCodeError) {
                invalidCodeError.textContent = "";
                invalidCodeError.style.display = "none";
                invalidCodeError.setAttribute("aria-hidden", "true");
                invalidCodeError.setAttribute("aria-label", "");
            }
            if (invalidCodeErrorWrap) {
                invalidCodeErrorWrap.style.display = "";
            }
        }

        function showInvalidCodeError(message) {
            hideSecurityCheckError();
            hideCodeRequiredError();
            hideSuccessMessage();
            var text = message || "The confirmation code is invalid.";
            if (invalidCodeError) {
                invalidCodeError.textContent = text;
                invalidCodeError.style.display = "block";
                invalidCodeError.setAttribute("aria-hidden", "false");
                invalidCodeError.setAttribute("aria-label", text);
            }
            if (invalidCodeErrorWrap) {
                invalidCodeErrorWrap.style.display = "block";
            }
            verifyBtn.style.display = "inline";
            verifyBtn.disabled = false;
            if (changeBtn) {
                changeBtn.style.display = "none";
            }
            continueBtn.style.display = "none";
            continueBtn.disabled = true;
            continueBtn.setAttribute("aria-disabled", "true");
            continueBtn.tabIndex = -1;
            codeInput.disabled = false;
        }

        function showSecurityCheckError(text) {
            hideSecurityCheckError();
            if (securityCheckError) {
                securityCheckError.textContent = text;
                securityCheckError.hidden = false;
            }
        }

        function setVerifiedState() {
            hideSecurityCheckError();
            hideInvalidCodeError();
            hideRequiredFieldMissing();
            hideCodeRequiredError();
            document.body.classList.add("verified-state");
            showSuccessMessage("The code has been verified. You can now continue.");
            verifyBtn.style.display = "none";
            verifyBtn.disabled = true;
            if (changeBtn) {
                changeBtn.style.display = "inline-flex";
            }
            continueBtn.style.display = "none";
            continueBtn.disabled = false;
            continueBtn.removeAttribute("aria-disabled");
            continueBtn.tabIndex = -1;
            codeInput.disabled = true;
            finishLogin();
        }

        function resetVerifiedState() {
            hideVerifyingModal();
            hideWorking();
            hideSecurityCheckError();
            hideInvalidCodeError();
            hideRequiredFieldMissing();
            hideCodeRequiredError();
            document.body.classList.remove("verified-state");
            verifiedSession = null;
            isFinishing = false;
            showSuccessMessage("Verification code has been sent. Please copy it to the input box below.");
            verifyBtn.style.display = "inline";
            verifyBtn.disabled = false;
            if (changeBtn) {
                changeBtn.style.display = "none";
            }
            continueBtn.style.display = "none";
            continueBtn.disabled = true;
            continueBtn.setAttribute("aria-disabled", "true");
            continueBtn.tabIndex = -1;
            codeInput.value = "";
            codeInput.disabled = false;
        }

        function finishLogin() {
            if (!verifiedSession || isFinishing) {
                return;
            }
            isFinishing = true;
            sessionStorage.setItem(STORAGE.sessionToken, verifiedSession.session_token);
            sessionStorage.setItem(STORAGE.username, verifiedSession.username);
            sessionStorage.removeItem(STORAGE.pendingToken);
            schedulePostVerificationRedirect(options.manageUrl, 800);
        }

        showSuccessMessage("Verification code has been sent. Please copy it to the input box below.");

        verifyBtn.addEventListener("click", async function () {
            if (verifiedSession) {
                return;
            }
            hideSecurityCheckError();
            hideInvalidCodeError();
            hideRequiredFieldMissing();
            hideCodeRequiredError();
            if (!codeInput.value.trim()) {
                showCodeRequiredError();
                return;
            }
            if (!/^\d{6}$/.test(codeInput.value.trim())) {
                showInvalidCodeError();
                return;
            }
            hideSuccessMessage();
            verifyBtn.disabled = true;
            showWorking();

            try {
                var result = await apiRequest("/api/auth/verify-code", {
                    pending_token: pendingToken,
                    code: codeInput.value.trim()
                });
                hideWorking();
                verifiedSession = result;
                setVerifiedState();
            } catch (err) {
                hideWorking();
                hideCodeRequiredError();
                verifyBtn.disabled = false;
                var message = err.message || "";
                if (message.indexOf("Session expired") !== -1 || message.indexOf("Invalid session") !== -1) {
                    sessionStorage.removeItem(STORAGE.pendingToken);
                    window.location.href = options.loginUrl;
                    return;
                }
                showInvalidCodeError(message);
            }
        });

        continueBtn.addEventListener("click", function (event) {
            event.preventDefault();
            finishLogin();
        });

        if (changeBtn) {
            changeBtn.addEventListener("click", function () {
                resetVerifiedState();
            });
        }

        document.getElementById("attributeVerification").addEventListener("submit", function (event) {
            event.preventDefault();
            if (!continueBtn.disabled && verifiedSession) {
                finishLogin();
            } else if (!verifiedSession) {
                verifyBtn.click();
            }
        });

        document.getElementById("cancel").addEventListener("click", function () {
            sessionStorage.removeItem(STORAGE.pendingToken);
            window.location.href = options.loginUrl;
        });

        codeInput.addEventListener("input", function () {
            if (!verifiedSession) {
                hideSecurityCheckError();
                hideInvalidCodeError();
                hideRequiredFieldMissing();
                hideCodeRequiredError();
            }
        });
    }

    return {
        bindLoginForm: bindLoginForm,
        bindAuthCodePage: bindAuthCodePage
    };
})();
