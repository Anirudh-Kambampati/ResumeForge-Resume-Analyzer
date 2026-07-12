"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeUrl = normalizeUrl;
exports.normalizeEmail = normalizeEmail;
function normalizeUrl(value) {
    const trimmed = value?.trim() || "";
    if (!trimmed)
        return "";
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}
function normalizeEmail(value) {
    const trimmed = value?.trim() || "";
    if (!trimmed)
        return "";
    return /^mailto:/i.test(trimmed) ? trimmed : `mailto:${trimmed}`;
}
