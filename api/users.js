const { supabase } = require("./supabase");

function mapUser(row) {
    if (!row) {
        return null;
    }
    return {
        id: row.id,
        username: row.username,
        password_hash: row.password_hash,
        totp_secret: row.totp_secret,
        created_at: row.created_at,
        last_used_totp_counter: row.last_used_totp_counter,
        pdf_filename: row.pdf_filename,
        pdf_original_name: row.pdf_original_name,
        pdf_uploaded_at: row.pdf_uploaded_at
    };
}

async function findByUsername(username) {
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .ilike("username", username)
        .maybeSingle();

    if (error) {
        throw error;
    }
    return mapUser(data);
}

async function findById(id) {
    const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .maybeSingle();

    if (error) {
        throw error;
    }
    return mapUser(data);
}

async function listUsers() {
    const { data, error } = await supabase
        .from("users")
        .select("id, username, totp_secret, created_at, pdf_filename, pdf_original_name, pdf_uploaded_at")
        .order("id", { ascending: false });

    if (error) {
        throw error;
    }
    return data || [];
}

async function createUser(username, passwordHash, totpSecret) {
    const { data, error } = await supabase
        .from("users")
        .insert({
            username: username,
            password_hash: passwordHash,
            totp_secret: totpSecret
        })
        .select("id, username, totp_secret, created_at")
        .single();

    if (error) {
        throw error;
    }
    return mapUser(data);
}

async function deleteUser(id) {
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) {
        throw error;
    }
}

async function updateLastUsedCounter(id, counter) {
    const { error } = await supabase
        .from("users")
        .update({ last_used_totp_counter: counter })
        .eq("id", id);

    if (error) {
        throw error;
    }
}

async function updatePdfMeta(id, filename, originalName) {
    const { error } = await supabase
        .from("users")
        .update({
            pdf_filename: filename,
            pdf_original_name: originalName,
            pdf_uploaded_at: new Date().toISOString()
        })
        .eq("id", id);

    if (error) {
        throw error;
    }
}

async function clearPdfMeta(id) {
    const { error } = await supabase
        .from("users")
        .update({
            pdf_filename: null,
            pdf_original_name: null,
            pdf_uploaded_at: null
        })
        .eq("id", id);

    if (error) {
        throw error;
    }
}

async function healthCheck() {
    const { error } = await supabase.from("users").select("id").limit(1);
    if (error) {
        throw error;
    }
}

module.exports = {
    findByUsername,
    findById,
    listUsers,
    createUser,
    deleteUser,
    updateLastUsedCounter,
    updatePdfMeta,
    clearPdfMeta,
    healthCheck
};
