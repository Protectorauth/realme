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

function isMissingTableError(error) {
    const message = String(error?.message || error?.details || "");
    const code = String(error?.code || "");
    return (
        code === "PGRST205" ||
        code === "42P01" ||
        message.includes("Could not find the table") ||
        (message.includes("login_banner") && message.includes("does not exist"))
    );
}

function toClientError(error) {
    if (isMissingTableError(error)) {
        return "Login banner table is missing. Run supabase/add-login-banner.sql in Supabase SQL Editor.";
    }
    return "Server error.";
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
        .upsert(
            {
                id: 1,
                is_visible: true,
                message_html: DEFAULT_MESSAGE_HTML
            },
            { onConflict: "id" }
        )
        .select("is_visible, message_html, updated_at")
        .single();

    if (error) {
        throw error;
    }

    return mapBanner(data);
}

async function updateBanner(isVisible, messageHtml) {
    const payload = {
        is_visible: Boolean(isVisible),
        message_html: sanitizeBannerHtml(messageHtml),
        updated_at: new Date().toISOString()
    };

    const { data: existing, error: readError } = await supabase
        .from("login_banner")
        .select("id")
        .eq("id", 1)
        .maybeSingle();

    if (readError) {
        throw readError;
    }

    let result;
    if (existing) {
        result = await supabase
            .from("login_banner")
            .update(payload)
            .eq("id", 1)
            .select("is_visible, message_html, updated_at")
            .single();
    } else {
        result = await supabase
            .from("login_banner")
            .insert(Object.assign({ id: 1 }, payload))
            .select("is_visible, message_html, updated_at")
            .single();
    }

    if (result.error) {
        throw result.error;
    }

    return mapBanner(result.data);
}

module.exports = {
    DEFAULT_MESSAGE_HTML,
    getBanner,
    ensureDefault,
    updateBanner,
    sanitizeBannerHtml,
    toClientError
};
