window.RealMeManage = (function () {
    var PLACEHOLDER_USERNAME = "accountuser";

    function applyLoggedInUsername() {
        var username = sessionStorage.getItem("realme_username");
        if (!username) {
            return;
        }

        document.querySelectorAll("#activity-rows tr[data-row]").forEach(function (row) {
            var actionByCells = row.querySelectorAll("td.f-view");
            if (actionByCells.length) {
                actionByCells[actionByCells.length - 1].textContent = username;
            }
        });

        document.querySelectorAll("#activity-rows tr.m-b-view div").forEach(function (div) {
            var spans = div.querySelectorAll("span");
            if (spans.length >= 2 && spans[0].textContent.trim() === "Action By") {
                spans[1].textContent = username;
            }
        });

        document.querySelectorAll('input[value="' + PLACEHOLDER_USERNAME + '"]').forEach(function (input) {
            input.value = username;
        });

        document.querySelectorAll('input[value*="RealMe:' + PLACEHOLDER_USERNAME + '"]').forEach(function (input) {
            input.value = input.value.replace(/RealMe:accountuser/g, "RealMe:" + username);
        });

        var deepLink = document.getElementById("strongAuthenticationAppUserDeepLink");
        if (deepLink && deepLink.href) {
            deepLink.href = deepLink.href.replace(/RealMe:accountuser/g, "RealMe:" + encodeURIComponent(username));
        }
    }

    function unescapeHTML(html) {
        if (!html) {
            return "";
        }
        try {
            return decodeURI(html).replace(/<\/br>/gi, "<br>");
        } catch (e) {
            return html.replace(/<\/br>/gi, "<br>");
        }
    }

    function setHtml(selector, value) {
        document.querySelectorAll(selector).forEach(function (el) {
            el.innerHTML = unescapeHTML(value || "");
        });
    }

    function showModal(id) {
        var modal = document.getElementById(id);
        if (modal) {
            modal.style.display = "block";
            modal.classList.add("show");
            modal.setAttribute("aria-hidden", "false");
        }
    }

    function hideModal(id) {
        var modal = document.getElementById(id);
        if (modal) {
            modal.style.display = "none";
            modal.classList.remove("show");
            modal.setAttribute("aria-hidden", "true");
        }
    }

    function hideConsent() {
        var homeContent = document.getElementById("HomeContent");
        var consentTerms = document.getElementById("ConsentTerms");
        var loading = document.getElementById("loading");
        var profileTitle = document.querySelector(".profile-title");

        if (homeContent) {
            homeContent.classList.remove("hide");
        }
        if (consentTerms) {
            consentTerms.classList.add("hide");
        }
        if (loading) {
            loading.classList.add("hide");
        }
        if (profileTitle) {
            profileTitle.style.display = "";
        }
    }

    function hideVisaConsentPdf() {
        var panel = document.getElementById("visaConsentPdfPanel");
        if (!panel) {
            return;
        }
        panel.classList.add("hide");
        panel.innerHTML = "";
    }

    function loadPdfJs() {
        if (window.pdfjsLib) {
            return Promise.resolve(window.pdfjsLib);
        }
        if (window.__pdfJsLoading) {
            return window.__pdfJsLoading;
        }
        window.__pdfJsLoading = new Promise(function (resolve, reject) {
            var script = document.createElement("script");
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
            script.onload = function () {
                pdfjsLib.GlobalWorkerOptions.workerSrc =
                    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
                resolve(pdfjsLib);
            };
            script.onerror = function () {
                reject(new Error("Could not load PDF viewer."));
            };
            document.head.appendChild(script);
        });
        return window.__pdfJsLoading;
    }

    async function renderPdfPages(panel, blob) {
        var pdfjs = await loadPdfJs();
        var arrayBuffer = await blob.arrayBuffer();
        var pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

        panel.innerHTML = '<div class="consent-pdf-pages"></div>';
        var container = panel.querySelector(".consent-pdf-pages");
        var panelWidth = panel.clientWidth || 786;

        for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            var page = await pdf.getPage(pageNum);
            var baseViewport = page.getViewport({ scale: 1 });
            var scale = panelWidth / baseViewport.width;
            var viewport = page.getViewport({ scale: scale });
            var canvas = document.createElement("canvas");
            canvas.className = "consent-pdf-page";
            var context = canvas.getContext("2d");
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            container.appendChild(canvas);
            await page.render({ canvasContext: context, viewport: viewport }).promise;
        }
    }

    function ensureVisaPdfPanel() {
        var visaCard = document.querySelector('#ConsentInfo .consent[data-consent-type="visa"]');
        if (!visaCard) {
            return null;
        }

        var panel = document.getElementById("visaConsentPdfPanel");
        if (!panel) {
            panel = document.createElement("div");
            panel.id = "visaConsentPdfPanel";
            panel.className = "consent-pdf-panel hide";
            visaCard.insertAdjacentElement("afterend", panel);
        } else if (panel.previousElementSibling !== visaCard) {
            visaCard.insertAdjacentElement("afterend", panel);
        }
        return panel;
    }

    async function showVisaConsentPdf() {
        var panel = ensureVisaPdfPanel();
        if (!panel) {
            return;
        }

        var sessionToken = sessionStorage.getItem("realme_session_token");
        if (!sessionToken) {
            panel.classList.remove("hide");
            panel.innerHTML = '<p class="consent-pdf-message">Please log in again to view this document.</p>';
            panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
            return;
        }

        panel.classList.remove("hide");
        panel.innerHTML = '<p class="consent-pdf-message">Loading document...</p>';
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });

        try {
            var response = await fetch("/api/user/consent-pdf", {
                headers: { Authorization: "Bearer " + sessionToken }
            });

            if (!response.ok) {
                var errorData = {};
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = {};
                }
                panel.innerHTML =
                    '<p class="consent-pdf-message">' +
                    (errorData.error || "No document available for this consent.") +
                    "</p>";
                return;
            }

            var blob = await response.blob();
            await renderPdfPages(panel, blob);
        } catch (e) {
            panel.innerHTML = '<p class="consent-pdf-message">Could not load the document.</p>';
        }
    }

    function showConsentTerms(button) {
        var homeContent = document.getElementById("HomeContent");
        var consentTerms = document.getElementById("ConsentTerms");
        var profileTitle = document.querySelector(".profile-title");
        var sourceId = (button.getAttribute("data-source-id") || "").trim();
        var consentStatus = (button.getAttribute("data-status") || "").trim();
        var agency = button.getAttribute("data-agency") || "";

        if (homeContent) {
            homeContent.classList.add("hide");
        }
        if (consentTerms) {
            consentTerms.classList.remove("hide");
        }
        if (profileTitle) {
            profileTitle.style.display = "none";
        }

        document.querySelectorAll(".privacy-block").forEach(function (el) {
            el.classList.add("hide");
        });
        document.querySelectorAll(".consent-title").forEach(function (el) {
            el.classList.add("hide");
        });

        var identityConsentBtns = document.getElementById("IdentityConsentBtns");
        if (identityConsentBtns) {
            identityConsentBtns.classList.add("hide");
        }

        document.querySelectorAll(".terms-agency").forEach(function (el) {
            el.textContent = agency;
        });

        setHtml(".terms-requested", button.getAttribute("data-terms-requested"));
        setHtml(".terms-use", button.getAttribute("data-terms-use"));
        setHtml(".terms-provider-source", button.getAttribute("data-terms-provider-source"));
        setHtml(".terms-destination", button.getAttribute("data-terms-destination"));
        setHtml(".terms-send-condition", button.getAttribute("data-terms-send-condition"));
        setHtml(".terms-retained-duration", button.getAttribute("data-terms-retained-duration"));
        setHtml(".terms-use-other", button.getAttribute("data-terms-use-other"));
        setHtml(".terms-help", button.getAttribute("data-terms-help"));

        var termsBlock = document.getElementById("TermsBlock");
        var ivsTerms = document.getElementById("IvsTerms");
        var avsTerms = document.getElementById("AvsTerms");
        var contactDetailTerms = document.getElementById("ContactDetailTerms");
        var termsError = document.getElementById("TermsError");
        var cancelConsentBtns = document.getElementById("CancelConsentBtns");
        var avsCancelConsentBtns = document.getElementById("AvsCancelConsentBtns");
        var contactDetailCancelConsentBtns = document.getElementById("ContactDetailCancelConsentBtns");
        var isActive = consentStatus.toLowerCase() === "active";

        if (termsBlock) {
            termsBlock.classList.remove("hide");
        }
        if (termsError) {
            termsError.classList.add("hide");
        }

        document.querySelectorAll(".terms-title").forEach(function (el) {
            el.textContent = "identity";
        });

        if (ivsTerms) {
            ivsTerms.classList.add("hide");
        }
        if (avsTerms) {
            avsTerms.classList.add("hide");
        }
        if (contactDetailTerms) {
            contactDetailTerms.classList.add("hide");
        }
        if (cancelConsentBtns) {
            cancelConsentBtns.classList.add("hide");
        }
        if (avsCancelConsentBtns) {
            avsCancelConsentBtns.classList.add("hide");
        }
        if (contactDetailCancelConsentBtns) {
            contactDetailCancelConsentBtns.classList.add("hide");
        }

        if (sourceId.toLowerCase() === "ivs") {
            document.querySelectorAll(".terms-title").forEach(function (el) {
                el.textContent = "identity";
            });
            if (ivsTerms) {
                ivsTerms.classList.remove("hide");
            }
            if (cancelConsentBtns) {
                cancelConsentBtns.classList.toggle("hide", !isActive);
            }
        } else if (sourceId.toLowerCase() === "avs") {
            document.querySelectorAll(".terms-title").forEach(function (el) {
                el.textContent = "address";
            });
            if (avsTerms) {
                avsTerms.classList.remove("hide");
            }
            if (avsCancelConsentBtns) {
                avsCancelConsentBtns.classList.toggle("hide", !isActive);
            }
        } else if (sourceId) {
            document.querySelectorAll(".terms-title").forEach(function (el) {
                el.textContent = "contact detail";
            });
            if (contactDetailTerms) {
                contactDetailTerms.classList.remove("hide");
            }
            if (contactDetailCancelConsentBtns) {
                contactDetailCancelConsentBtns.classList.toggle("hide", !isActive);
            }
        } else if (termsError) {
            termsError.classList.remove("hide");
        }

        var entityInput = document.getElementById("ConsentEntityId");
        var consentIdInput = document.getElementById("ConsentId");
        var sourceInput = document.getElementById("ConsentAttributeSource");

        if (entityInput) {
            entityInput.value = button.getAttribute("data-entity") || "";
        }
        if (consentIdInput) {
            consentIdInput.value = button.getAttribute("data-consent-id") || "";
        }
        if (sourceInput) {
            sourceInput.value = sourceId;
        }

        window.scrollTo(0, 0);
    }

    function initConsentView() {
        document.querySelectorAll(".btn-terms[id^='view-consent-']").forEach(function (button) {
            button.addEventListener("click", function () {
                if (button.getAttribute("data-consent-view") === "pdf") {
                    showVisaConsentPdf();
                    return;
                }
                hideVisaConsentPdf();
                showConsentTerms(button);
            });
        });

        var backHome = document.getElementById("BackHome");
        if (backHome) {
            backHome.addEventListener("click", hideConsent);
        }

        document.querySelectorAll(".cancel-consent").forEach(function (button) {
            button.addEventListener("click", function () {
                showModal("CancelConsentModal");
            });
        });

        var closeCancelModal = document.getElementById("CloseCancelConsentModalBtn");
        if (closeCancelModal) {
            closeCancelModal.addEventListener("click", function () {
                hideModal("CancelConsentModal");
                hideConsent();
            });
        }

        var confirmCancel = document.getElementById("ConfirmCancelConsentBtn");
        if (confirmCancel) {
            confirmCancel.addEventListener("click", function () {
                hideModal("CancelConsentModal");
                hideConsent();
            });
        }

        initConsentFilter();
    }

    function applyConsentFilter(filterValue) {
        var cards = document.querySelectorAll("#ConsentInfo .consent[data-consent-filter]");
        var emptyMessage = document.getElementById("ConsentEmptyMessage");
        var visibleCount = 0;

        cards.forEach(function (card) {
            var filters = (card.getAttribute("data-consent-filter") || "").split(/\s+/);
            var show = filters.indexOf(filterValue) !== -1;
            card.classList.toggle("hide", !show);
            if (show) {
                visibleCount += 1;
            }
        });

        if (emptyMessage) {
            emptyMessage.classList.toggle("hide", visibleCount > 0);
        }

        if (filterValue !== "Visa" && filterValue !== "All") {
            hideVisaConsentPdf();
        }
    }

    function initConsentFilter() {
        var select = document.getElementById("consentDisplayOptions");
        if (!select) {
            return;
        }

        applyConsentFilter(select.value || "Active");
        select.addEventListener("change", function () {
            applyConsentFilter(select.value || "Active");
        });
    }

    function init() {
        applyLoggedInUsername();
        initConsentView();
    }

    return {
        applyLoggedInUsername: applyLoggedInUsername,
        hideConsent: hideConsent,
        init: init
    };
})();
