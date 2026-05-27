window.RealMeAPI = (function () {
    var base = "";

    if (typeof window.REALME_API_BASE === "string" && window.REALME_API_BASE) {
        base = window.REALME_API_BASE.replace(/\/$/, "");
    }

    function url(path) {
        return base + path;
    }

    return {
        base: base,
        url: url,
        isRemote: function () {
            return base.length > 0;
        },
        credentials: function () {
            return base ? "omit" : "same-origin";
        }
    };
})();
