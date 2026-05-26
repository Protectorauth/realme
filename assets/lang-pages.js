window.REALME_LANG_PAGES = {
  enToMi: {
    "home.html": "mi/home.html",
    "index.html": "mi/index.html",
    "login.html": "mi/login.html",
    "login-auth-code.html": "mi/login-auth-code.html",
    "create-login.html": "mi/create-login.html",
    "create-login-2.html": "mi/create-login-2.html",
    "enter-realme-code.html": "mi/enter-realme-code.html",
    "manage-login.html": "mi/manage-login.html",
    "verified-identity.html": "mi/verified-identity.html",
    "where-to-use.html": "mi/where-to-use.html",
    "protecting-your-privacy.html": "mi/protecting-your-privacy.html",
    "work-with-us.html": "mi/work-with-us.html",
    "help.html": "mi/help.html",
    "about-us.html": "mi/about-us.html",
    "contact-us.html": "mi/contact-us.html",
    "taking-your-own-photo.html": "mi/taking-your-own-photo.html",
    "find-realme-partner-store.html": "mi/find-realme-partner-store.html",
    "renew-your-verified-identity.html": "mi/renew-your-verified-identity.html"
  }
};

window.REALME_LANG_PAGES.miToEn = Object.keys(window.REALME_LANG_PAGES.enToMi).reduce(function (acc, en) {
  acc[window.REALME_LANG_PAGES.enToMi[en]] = en;
  return acc;
}, {});
