window.RealMeLoginBanner = (function () {
    function load(containerId) {
        var container = document.getElementById(containerId || "login-warning-banner");
        if (!container || !window.RealMeAPI) {
            return Promise.resolve();
        }

        return fetch(window.RealMeAPI.url("/api/public/login-banner"), {
            credentials: window.RealMeAPI.credentials()
        })
            .then(function (response) {
                return response.json().then(function (data) {
                    return { ok: response.ok, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok || !result.data.visible || !result.data.html) {
                    container.hidden = true;
                    container.innerHTML = "";
                    return;
                }

                container.innerHTML =
                    '<div class="inner"><p id="global-message">' + result.data.html + "</p></div>";
                container.hidden = false;
            })
            .catch(function () {
                container.hidden = true;
                container.innerHTML = "";
            });
    }

    return { load: load };
})();
