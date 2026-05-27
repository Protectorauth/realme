window.AdminAPI = (function () {
    var ADMIN_TOKEN_KEY = "realme_admin_token";

    function authHeaders(extra) {
        var headers = Object.assign({ "Content-Type": "application/json" }, extra || {});
        var token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
        if (token) {
            headers.Authorization = "Bearer " + token;
        }
        return headers;
    }

    async function request(url, options) {
        var response = await fetch(window.RealMeAPI.url(url), Object.assign({
            credentials: window.RealMeAPI.credentials(),
            headers: authHeaders()
        }, options || {}));

        var data = null;
        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            var error = new Error(data.error || "Request failed.");
            error.status = response.status;
            throw error;
        }

        return data;
    }

    async function uploadRequest(url, formData) {
        var headers = {};
        var token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
        if (token) {
            headers.Authorization = "Bearer " + token;
        }

        var response = await fetch(window.RealMeAPI.url(url), {
            method: "POST",
            credentials: window.RealMeAPI.credentials(),
            headers: headers,
            body: formData
        });

        var data = null;
        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            var error = new Error(data.error || "Upload failed.");
            error.status = response.status;
            throw error;
        }

        return data;
    }

    return {
        login: function (username, password) {
            return request("/api/admin/login", {
                method: "POST",
                body: JSON.stringify({ username: username, password: password })
            }).then(function (data) {
                if (data.token) {
                    sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
                }
                return data;
            });
        },
        logout: function () {
            sessionStorage.removeItem(ADMIN_TOKEN_KEY);
            return request("/api/admin/logout", { method: "POST" });
        },
        checkSession: function () {
            return request("/api/admin/session");
        },
        getUsers: function () {
            return request("/api/admin/users");
        },
        createUser: function (username, password) {
            return request("/api/admin/users", {
                method: "POST",
                body: JSON.stringify({ username: username, password: password })
            });
        },
        deleteUser: function (id) {
            return request("/api/admin/users/" + encodeURIComponent(id), {
                method: "DELETE"
            });
        },
        uploadUserPdf: function (id, file) {
            var formData = new FormData();
            formData.append("pdf", file);
            return uploadRequest("/api/admin/users/" + encodeURIComponent(id) + "/pdf", formData);
        },
        deleteUserPdf: function (id) {
            return request("/api/admin/users/" + encodeURIComponent(id) + "/pdf", {
                method: "DELETE"
            });
        },
        getUserPdfUrl: function (id) {
            return window.RealMeAPI.url("/api/admin/users/" + encodeURIComponent(id) + "/pdf");
        },
        getLoginBanner: function () {
            return request("/api/admin/login-banner");
        },
        updateLoginBanner: function (visible, html) {
            return request("/api/admin/login-banner", {
                method: "PUT",
                body: JSON.stringify({ visible: visible, html: html })
            });
        }
    };
})();
