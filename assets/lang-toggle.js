(function () {
  var DEFAULT_EN = "home.html";
  var DEFAULT_MI = "mi/home.html";

  function getPageKey() {
    var path = window.location.pathname.replace(/\\/g, "/");
    var parts = path.split("/").filter(Boolean);
    var miIndex = parts.indexOf("mi");
    var inMi = miIndex !== -1;
    var file = parts.length ? parts[parts.length - 1] : "";

    if (/\.html$/i.test(file)) {
      file = file.toLowerCase();
    } else if (/^home$/i.test(file)) {
      file = "home.html";
    } else if (!file) {
      file = "index.html";
    } else if (inMi && parts.length === miIndex + 1) {
      file = "index.html";
    } else {
      file = "home.html";
    }

    if (inMi) {
      return "mi/" + file;
    }

    return file;
  }

  function getSiteBasePath() {
    var path = window.location.pathname.replace(/\\/g, "/");
    var parts = path.split("/").filter(Boolean);
    var miIndex = parts.indexOf("mi");

    if (miIndex !== -1) {
      parts = parts.slice(0, miIndex);
    } else if (parts.length > 0) {
      parts = parts.slice(0, -1);
    }

    if (!parts.length) {
      return "/";
    }

    return "/" + parts.join("/") + "/";
  }

  function getTargetPath(lang) {
    var map = window.REALME_LANG_PAGES.enToMi;
    var rev = window.REALME_LANG_PAGES.miToEn;
    var key = getPageKey();
    var inMi = key.indexOf("mi/") === 0;
    var base = getSiteBasePath();

    if (lang === "mi" && !inMi) {
      return base + (map[key] || DEFAULT_MI);
    }

    if (lang === "en" && inMi) {
      return base + (rev[key] || DEFAULT_EN);
    }

    return null;
  }

  function navigateToLang(lang) {
    var target = getTargetPath(lang);

    if (target) {
      window.location.href = target;
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-lang-switch]").forEach(function (link) {
      var lang = link.getAttribute("data-lang-switch");
      var target = getTargetPath(lang);

      if (target) {
        link.setAttribute("href", target);
      }

      link.addEventListener("click", function (event) {
        event.preventDefault();
        navigateToLang(lang);
      });
    });
  });
})();
