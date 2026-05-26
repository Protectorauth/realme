window.AdminAPI = (function () {
    async function request(url, options) {
        var response = await fetch(url, Object.assign({
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" }
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
        var response = await fetch(url, {
            method: "POST",
            credentials: "same-origin",
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
            });
        },
        logout: function () {
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
            return "/api/admin/users/" + encodeURIComponent(id) + "/pdf";
        }
    };
})();
