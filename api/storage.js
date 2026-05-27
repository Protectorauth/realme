const { supabase, pdfBucket } = require("./supabase");

function buildPdfPath(userId) {
    return "user-" + userId + "-" + Date.now() + ".pdf";
}

async function uploadPdf(path, buffer, contentType) {
    const { error } = await supabase.storage.from(pdfBucket).upload(path, buffer, {
        contentType: contentType || "application/pdf",
        upsert: true
    });

    if (error) {
        throw error;
    }
}

async function deletePdf(path) {
    if (!path) {
        return;
    }

    const { error } = await supabase.storage.from(pdfBucket).remove([path]);
    if (error) {
        throw error;
    }
}

async function downloadPdf(path) {
    const { data, error } = await supabase.storage.from(pdfBucket).download(path);
    if (error) {
        throw error;
    }
    return data;
}

module.exports = {
    buildPdfPath,
    uploadPdf,
    deletePdf,
    downloadPdf
};
