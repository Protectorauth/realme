window.RealMeLoginRoute = (function () {
    var path = "/32179062-92f6-4eb0-89bc-df400a9e0367/oauth2/v2.0/authorize";
    var query =
        "p=B2C_1A_DIA_RealMe_Home" +
        "&client_id=5e90bca8-7dd9-4399-8863-340a4c002ce7" +
        "&redirect_uri=https://api.realme.govt.nz/sls/continue" +
        "&scope=openid" +
        "&state=home" +
        "&response_type=code" +
        "&prompt=login";

    function url() {
        return path + "?" + query;
    }

    function redirectFromLegacyLoginPage() {
        var current = window.location.pathname.replace(/\\/g, "/");
        if (current.endsWith("/login.html")) {
            window.location.replace(url());
        }
    }

    return {
        path: path,
        url: url,
        redirectFromLegacyLoginPage: redirectFromLegacyLoginPage
    };
})();
