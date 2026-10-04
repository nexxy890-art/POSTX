const fs = require("fs");
const { google } = require("googleapis");

async function upload({
  account,
  filePath,
  caption,
  onProgress
}) {
  if (!account.access_token) {
    throw new Error("YouTube access token is missing.");
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token || undefined
  });

  const youtube = google.youtube({
    version: "v3",
    auth: oauth2Client
  });

  const title =
    caption
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 100) || "POSTX Video";

  const response = await youtube.videos.insert({
    part: ["snippet", "status"],

    requestBody: {
      snippet: {
        title,
        description: caption || ""
      },

      status: {
        privacyStatus:
          process.env.YOUTUBE_PRIVACY_STATUS || "public"
      }
    },

    media: {
      body: fs.createReadStream(filePath)
    },

    onUploadProgress: async (event) => {
      if (
        event.total &&
        typeof onProgress === "function"
      ) {
        const percent =
          (event.bytesRead / event.total) * 100;

        await onProgress(percent);
      }
    }
  });

  const videoId = response.data.id;

  if (!videoId) {
    throw new Error("YouTube did not return a video ID.");
  }

  return {
    id: videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`
  };
}

module.exports = {
  upload
};
