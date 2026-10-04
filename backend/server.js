require("dotenv").config();

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { createClient } = require("@supabase/supabase-js");

const youtube = require("./platforms/youtube");
const tiktok = require("./platforms/tiktok");
const instagram = require("./platforms/instagram");
const facebook = require("./platforms/facebook");

const app = express();

const PORT = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

app.use(cors({
  origin: process.env.FRONTEND_URL || "*"
}));

app.use(express.json());

app.use(
  "/media",
  express.static(uploadDir, {
    maxAge: "1h"
  })
);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },

  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || ".mp4";
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: Number(process.env.MAX_VIDEO_SIZE || 5368709120)
  },

  fileFilter: function (req, file, cb) {
    if (!file.mimetype.startsWith("video/")) {
      return cb(new Error("Only video files are allowed."));
    }

    cb(null, true);
  }
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Authentication required."
      });
    }

    const token = header.substring(7);

    const {
      data,
      error
    } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({
        error: "Invalid authentication token."
      });
    }

    req.user = data.user;

    next();
  } catch (error) {
    console.error(error);

    res.status(401).json({
      error: "Authentication failed."
    });
  }
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "POSTX Backend",
    version: "2.3.0",
    time: new Date().toISOString()
  });
});

app.post(
  "/api/upload",
  authenticate,
  upload.single("video"),
  async (req, res) => {
    let filePath = null;

    try {
      if (!req.file) {
        return res.status(400).json({
          error: "Video is required."
        });
      }

      filePath = req.file.path;

      let platforms = [];

      try {
        platforms = JSON.parse(req.body.platforms || "[]");
      } catch {
        platforms = [];
      }

      if (!Array.isArray(platforms) || platforms.length === 0) {
        return res.status(400).json({
          error: "At least one platform is required."
        });
      }

      const allowedPlatforms = [
        "youtube",
        "tiktok",
        "instagram",
        "facebook"
      ];

      platforms = platforms.filter((platform) =>
        allowedPlatforms.includes(platform)
      );

      if (!platforms.length) {
        return res.status(400).json({
          error: "No valid platform selected."
        });
      }

      const caption = String(req.body.caption || "").trim();

      const jobId = uuidv4();

      await supabase
        .from("upload_jobs")
        .insert({
          id: jobId,
          user_id: req.user.id,
          status: "processing",
          file_name: req.file.originalname,
          file_size: req.file.size
        });

      for (const platform of platforms) {
        await supabase
          .from("upload_targets")
          .insert({
            job_id: jobId,
            platform,
            status: "queued",
            progress: 0
          });
      }

      res.status(202).json({
        ok: true,
        job_id: jobId,
        message: "Upload job started."
      });

      processUploadJob({
        jobId,
        userId: req.user.id,
        filePath,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        platforms,
        caption
      });

    } catch (error) {
      console.error(error);

      if (filePath) {
        safeDelete(filePath);
      }

      res.status(500).json({
        error: error.message || "Upload failed."
      });
    }
  }
);

async function processUploadJob(data) {
  const {
    jobId,
    userId,
    filePath,
    originalName,
    mimeType,
    fileSize,
    platforms,
    caption
  } = data;

  try {
    const { data: accounts, error } = await supabase
      .from("connected_platforms")
      .select("*")
      .eq("user_id", userId)
      .in("platform", platforms);

    if (error) {
      throw error;
    }

    const accountMap = {};

    for (const account of accounts || []) {
      accountMap[account.platform] = account;
    }

    for (const platform of platforms) {
      const account = accountMap[platform];

      if (!account) {
        await updateTarget(jobId, platform, {
          status: "failed",
          error_message: "Platform account is not connected."
        });

        continue;
      }

      await updateTarget(jobId, platform, {
        status: "uploading",
        progress: 0
      });

      try {
        let result;

        const common = {
          account,
          filePath,
          originalName,
          mimeType,
          fileSize,
          caption,

          onProgress: async (progress) => {
            await updateTarget(jobId, platform, {
              status: "uploading",
              progress: Math.min(100, Math.round(progress))
            });
          }
        };

        if (platform === "youtube") {
          result = await youtube.upload(common);
        }

        if (platform === "tiktok") {
          result = await tiktok.upload(common);
        }

        if (platform === "instagram") {
          result = await instagram.upload(common);
        }

        if (platform === "facebook") {
          result = await facebook.upload(common);
        }

        await updateTarget(jobId, platform, {
          status: "completed",
          progress: 100,
          remote_id: result?.id || null,
          remote_url: result?.url || null,
          error_message: null
        });

      } catch (error) {
        console.error(`${platform} upload error:`, error);

        await updateTarget(jobId, platform, {
          status: "failed",
          error_message: error.message || "Platform upload failed."
        });
      }
    }

    const { data: targets } = await supabase
      .from("upload_targets")
      .select("status")
      .eq("job_id", jobId);

    const statuses = (targets || []).map((x) => x.status);

    let jobStatus = "processing";

    if (
      statuses.length &&
      statuses.every((status) => status === "completed")
    ) {
      jobStatus = "completed";
    } else if (
      statuses.length &&
      statuses.every((status) => status === "failed")
    ) {
      jobStatus = "failed";
    } else if (
      statuses.some((status) => status === "completed")
    ) {
      jobStatus = "partial";
    }

    await supabase
      .from("upload_jobs")
      .update({
        status: jobStatus,
        completed_at:
          jobStatus !== "processing"
            ? new Date().toISOString()
            : null
      })
      .eq("id", jobId);

  } catch (error) {
    console.error("Job error:", error);

    await supabase
      .from("upload_jobs")
      .update({
        status: "failed",
        error_message: error.message || "Job failed."
      })
      .eq("id", jobId);

  } finally {
    safeDelete(filePath);
  }
}

async function updateTarget(jobId, platform, values) {
  await supabase
    .from("upload_targets")
    .update(values)
    .eq("job_id", jobId)
    .eq("platform", platform);
}

function safeDelete(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("File delete error:", error);
  }
}

app.use((error, req, res, next) => {
  console.error(error);

  res.status(400).json({
    error: error.message || "Request failed."
  });
});

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════╗
║          POSTX BACKEND           ║
║            V2.3.0                ║
║       CREATE ONCE • POST         ║
╚══════════════════════════════════╝

Server: http://localhost:${PORT}
  `);
});
