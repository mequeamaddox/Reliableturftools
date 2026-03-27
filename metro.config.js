const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Exclude .local/ directory from Metro's file watcher
// This prevents crashes when Replit creates/deletes temp files in .local/
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const localPath = escapeRegExp(path.resolve(__dirname, ".local"));
config.resolver = config.resolver || {};
config.resolver.blockList = [new RegExp(`^${localPath}[\\/\\\\].*$`)];

module.exports = config;
