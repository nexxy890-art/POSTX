const axios = require("axios");

async function upload({
  account,
  caption,
  onProgress
}) {
  if (!account.access_token) {
    throw new Error("Facebook access token is missing.");
  }

  if (!process.env.PUBLIC_BASE_URL) {
    throw new Error(
      "PUBLIC_BASE_URL is required for Facebook video publishing."
    );
  }

  throw new Error(
    "Facebook publishing connector needs the connected media URL and Meta app configuration."
  );
}

module.exports = {
  upload
};
