const fs = require("fs");
const axios = require("axios");

async function upload({
  account,
  filePath,
  fileSize,
  mimeType,
  caption,
  onProgress
}) {
  if (!account.access_token) {
    throw new Error("TikTok access token is missing.");
  }

  const chunkSize = Math.min(
    10 * 1024 * 1024,
    fileSize
  );

  const totalChunks = Math.ceil(
    fileSize / chunkSize
  );

  const initResponse = await axios.post(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      post_info: {
        title: caption || "POSTX Video",
        privacy_level:
          process.env.TIKTOK_PRIVACY_LEVEL ||
          "SELF_ONLY",
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false
      },

      source_info: {
        source: "FILE_UPLOAD",
        video_size: fileSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunks
      }
    },
    {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        "Content-Type": "application/json"
      }
    }
  );

  const data = initResponse.data?.data;

  if (!data?.upload_url) {
    throw new Error(
      initResponse.data?.error?.message ||
      "TikTok did not return an upload URL."
    );
  }

  const uploadUrl = data.upload_url;

  const file = fs.openSync(filePath, "r");

  try {
    let uploaded = 0;

    for (let index = 0; index < totalChunks; index++) {
      const start = index * chunkSize;

      const end = Math.min(
        start + chunkSize,
        fileSize
      );

      const currentSize = end - start;

      const buffer = Buffer.alloc(currentSize);

      fs.readSync(
        file,
        buffer,
        0,
        currentSize,
        start
      );

      await axios.put(
        uploadUrl,
        buffer,
        {
          headers: {
            "Content-Type": mimeType || "video/mp4",
            "Content-Length": currentSize,
            "Content-Range":
              `bytes ${start}-${end - 1}/${fileSize}`
          },

          maxBodyLength: Infinity,
          maxContentLength: Infinity
        }
      );

      uploaded = end;

      if (typeof onProgress === "function") {
        await onProgress(
          (uploaded / fileSize) * 100
        );
      }
    }
  } finally {
    fs.closeSync(file);
  }

  return {
    id: data.publish_id,
    url: null
  };
}

module.exports = {
  upload
};
