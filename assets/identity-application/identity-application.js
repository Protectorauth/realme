(function () {
    var form = document.getElementById("identityIntroForm");
    var termsCheckbox = document.getElementById("terms-checkbox");
    var getStartedBtn = document.getElementById("getStartedBtn");
    var cancelBtn = document.getElementById("cancelBtn");

    if (!form || !termsCheckbox || !getStartedBtn || !cancelBtn) {
        return;
    }

    termsCheckbox.addEventListener("change", function () {
        getStartedBtn.disabled = !termsCheckbox.checked;
    });

    cancelBtn.addEventListener("click", function () {
        window.location.href = "./manage-login.html";
    });

    form.addEventListener("submit", function (event) {
        event.preventDefault();
        if (!termsCheckbox.checked) {
            return;
        }
        getStartedBtn.disabled = true;
    });
})();
