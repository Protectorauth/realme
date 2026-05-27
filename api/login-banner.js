const { supabase } = require("./supabase");

const DEFAULT_MESSAGE_HTML =
    "<b>RealMe create login issue</b><br>\n" +
    "There is currently a known platform issue with \"Create a RealMe login\", when proceeding, you may receive an \"Unable to validate the information\" error. " +
    "As a workaround, continue by attempting to log in using the newly created user details. " +
    "This will allow you to proceed with completing the user creation process.";

function sanitizeBannerHtml(html) {
    return String(html || "")
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .trim();
}

function mapBanner(row) {
    if (!row) {
        return null;
    }
    return {
        is_visible: Boolean(row.is_visible),
        message_html: row.message_html || "",
        updated_at: row.updated_at
    };
}

async function getBanner() {
    const { data, error } = await supabase
        .from("login_banner")
        .select("is_visible, message_html, updated_at")
        .eq("id", 1)
        .maybeSingle();

    if (error) {
        throw error;
    }

    if (!data) {
        return ensureDefault();
    }

    return mapBanner(data);
}

async function ensureDefault() {
    const { data, error } = await supabase
        .from("login_banner")
        .upsert({
            id: 1,
            is_visible: true,
            message_html: DEFAULT_MESSAGE_HTML
        })
        .select("is_visible, message_html, updated_at")
        .single();

    if (error) {
        throw error;
    }

    return mapBanner(data);
}

async function updateBanner(isVisible, messageHtml) {
    const payload = {
        id: 1,
        is_visible: Boolean(isVisible),
        message_html: sanitizeBannerHtml(messageHtml),
        updated_at: new Date().toISOString()
    };

    const { data, error } = await supabase
        .from("login_banner")
        .upsert(payload)
        .select("is_visible, message_html, updated_at")
        .single();

    if (error) {
        throw error;
    }

    return mapBanner(data);
}

module.exports = {
    DEFAULT_MESSAGE_HTML,
    getBanner,
    ensureDefault,
    updateBanner,
    sanitizeBannerHtml
};
