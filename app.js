/* =====================================================
   POSTX V2.3
   Frontend Controller
===================================================== */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

/* -----------------------------------------------------
   STATE
----------------------------------------------------- */

const state = {
  video: null,
  thumbnail: null,
  platforms: new Set([
    "youtube",
    "tiktok",
    "instagram",
    "facebook"
  ]),
  uploadJobId: null
};

/* -----------------------------------------------------
   ELEMENTS
----------------------------------------------------- */

const videoInput = $("#videoInput");
const chooseVideoBtn = $("#chooseVideoBtn");
const dropZone = $("#dropZone");
const videoPreview = $("#videoPreview");
const videoPreviewBox = $("#videoPreviewBox");
const uploadPlaceholder = $("#uploadPlaceholder");
const videoName = $("#videoName");
const videoSize = $("#videoSize");
const fileInfo = $("#fileInfo");
const fileDuration = $("#fileDuration");
const removeVideoBtn = $("#removeVideoBtn");

const captionInput = $("#captionInput");
const captionCount = $("#captionCount");

const thumbnailInput = $("#thumbnailInput");
const thumbnailBox = $("#thumbnailBox");
const thumbnailPreview = $("#thumbnailPreview");
const thumbnailPlaceholder = $("#thumbnailPlaceholder");

const postBtn = $("#postEverywhereBtn");
const selectedCount = $("#selectedCount");

const settingsPanel = $("#settingsPanel");
const settingsBtn = $("#settingsBtn");
const closeSettings = $("#closeSettings");

const toast = $("#toast");

/* -----------------------------------------------------
   TOAST
----------------------------------------------------- */

let toastTimer;

function showToast(message) {
  clearTimeout(toastTimer);

  toast.textContent = message;
  toast.classList.add("show");

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

/* -----------------------------------------------------
   FILE SIZE
----------------------------------------------------- */

function formatBytes(bytes) {
  if (!bytes) return "0 MB";

  const mb = bytes / (1024 * 1024);

  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }

  return `${(mb / 1024).toFixed(2)} GB`;
}

/* -----------------------------------------------------
   VIDEO SELECT
----------------------------------------------------- */

chooseVideoBtn.addEventListener("click", () => {
  videoInput.click();
});

videoInput.addEventListener("change", () => {
  if (videoInput.files.length) {
    loadVideo(videoInput.files[0]);
  }
});

function loadVideo(file) {

  if (!file.type.startsWith("video/")) {
    showToast("Please select a video file.");
    return;
  }

  state.video = file;

  const url = URL.createObjectURL(file);

  videoPreview.src = url;

  uploadPlaceholder.classList.add("hidden");
  videoPreviewBox.classList.remove("hidden");

  videoName.textContent = file.name;
  videoSize.textContent = formatBytes(file.size);

  fileInfo.textContent = `${file.name} • ${formatBytes(file.size)}`;

  videoPreview.addEventListener(
    "loadedmetadata",
    () => {

      const seconds = Math.floor(videoPreview.duration);

      const minutes = Math.floor(seconds / 60);
      const remaining = seconds % 60;

      fileDuration.textContent =
        `${minutes}:${String(remaining).padStart(2, "0")}`;

    },
    { once: true }
  );

  updatePostButton();
  saveDraft();
}

/* -----------------------------------------------------
   REMOVE VIDEO
----------------------------------------------------- */

removeVideoBtn.addEventListener("click", () => {

  state.video = null;

  videoPreview.pause();
  videoPreview.removeAttribute("src");
  videoPreview.load();

  videoPreviewBox.classList.add("hidden");
  uploadPlaceholder.classList.remove("hidden");

  fileInfo.textContent = "No video selected";
  fileDuration.textContent = "—";

  videoInput.value = "";

  updatePostButton();
});

/* -----------------------------------------------------
   DRAG & DROP
----------------------------------------------------- */

["dragenter", "dragover"].forEach(eventName => {

  dropZone.addEventListener(eventName, (event) => {

    event.preventDefault();

    dropZone.classList.add("dragover");

  });

});

["dragleave", "drop"].forEach(eventName => {

  dropZone.addEventListener(eventName, (event) => {

    event.preventDefault();

    dropZone.classList.remove("dragover");

  });

});

dropZone.addEventListener("drop", (event) => {

  const file = event.dataTransfer.files[0];

  if (file) {
    loadVideo(file);
  }

});

/* -----------------------------------------------------
   CAPTION
----------------------------------------------------- */

captionInput.addEventListener("input", () => {

  captionCount.textContent =
    `${captionInput.value.length} / 2200`;

  saveDraft();

});

/* -----------------------------------------------------
   THUMBNAIL
----------------------------------------------------- */

thumbnailBox.addEventListener("click", () => {
  thumbnailInput.click();
});

thumbnailInput.addEventListener("change", () => {

  const file = thumbnailInput.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    showToast("Please select an image.");
    return;
  }

  state.thumbnail = file;

  thumbnailPreview.src = URL.createObjectURL(file);

  thumbnailPlaceholder.classList.add("hidden");
  thumbnailPreview.classList.remove("hidden");

  saveDraft();

});

/* -----------------------------------------------------
   PLATFORM SELECTION
----------------------------------------------------- */

$$(".platform-card").forEach(card => {

  card.addEventListener("click", () => {

    const platform = card.dataset.platform;

    if (state.platforms.has(platform)) {

      state.platforms.delete(platform);
      card.classList.remove("selected");

    } else {

      state.platforms.add(platform);
      card.classList.add("selected");

    }

    updateSelectedCount();
    updatePostButton();
    saveDraft();

  });

});

function updateSelectedCount() {

  const count = state.platforms.size;

  selectedCount.textContent =
    `${count} platform${count === 1 ? "" : "s"} selected`;

}

/* -----------------------------------------------------
   POST BUTTON
----------------------------------------------------- */

function updatePostButton() {

  const valid =
    state.video &&
    state.platforms.size > 0;

  postBtn.disabled = !valid;

}

postBtn.addEventListener("click", async () => {

  if (!state.video) {
    showToast("Video upload is required.");
    return;
  }

  if (!state.platforms.size) {
    showToast("Select at least one platform.");
    return;
  }

  /*
    Real backend upload will be connected here.

    The frontend DOES NOT fake successful
    YouTube/TikTok/Instagram/Facebook posts.
  */

  showToast(
    "Video ready. Backend upload service will start here."
  );

  prepareUploadRows();

});

/* -----------------------------------------------------
   UPLOAD ROWS
----------------------------------------------------- */

function prepareUploadRows() {

  $$(".upload-row").forEach(row => {

    const platform =
      row.dataset.uploadPlatform;

    const active =
      state.platforms.has(platform);

    if (active) {

      row.querySelector(".upload-state").textContent =
        "READY";

      row.querySelector(".upload-state")
        .className = "upload-state";

    } else {

      row.querySelector(".upload-state").textContent =
        "SKIPPED";

    }

  });

  $("#overallStatus").textContent = "READY";
  $("#totalSize").textContent =
    formatBytes(state.video.size);

}

/* -----------------------------------------------------
   REAL BACKEND PROGRESS HOOK
----------------------------------------------------- */

function updatePlatformProgress(
  platform,
  percent,
  speed,
  status
) {

  const row =
    document.querySelector(
      `[data-upload-platform="${platform}"]`
    );

  if (!row) return;

  const bar =
    row.querySelector(".progress-bar");

  const percentText =
    row.querySelector(".upload-percent");

  const speedText =
    row.querySelector(".upload-speed");

  const stateText =
    row.querySelector(".upload-state");

  bar.style.width = `${percent}%`;

  percentText.textContent =
    `${Math.round(percent)}%`;

  speedText.textContent =
    speed || "—";

  stateText.textContent =
    status;

}

/* -----------------------------------------------------
   SETTINGS
----------------------------------------------------- */

settingsBtn.addEventListener("click", () => {
  settingsPanel.classList.remove("hidden");
});

closeSettings.addEventListener("click", () => {
  settingsPanel.classList.add("hidden");
});

$(".modal-backdrop")?.addEventListener("click", () => {
  settingsPanel.classList.add("hidden");
});

/* -----------------------------------------------------
   DRAFT
----------------------------------------------------- */

function saveDraft() {

  const draft = {
    caption: captionInput.value,
    platforms: [...state.platforms]
  };

  localStorage.setItem(
    "postx_draft",
    JSON.stringify(draft)
  );

  $("#draftStatus").textContent =
    "DRAFT SAVED";
}

function loadDraft() {

  try {

    const saved =
      JSON.parse(
        localStorage.getItem("postx_draft")
      );

    if (!saved) return;

    captionInput.value =
      saved.caption || "";

    captionCount.textContent =
      `${captionInput.value.length} / 2200`;

  } catch {
    console.log("No valid draft found.");
  }

}

/* -----------------------------------------------------
   NETWORK
----------------------------------------------------- */

function updateNetworkStatus() {

  if (navigator.onLine) {

    $("#networkSpeed").textContent =
      "Network online";

  } else {

    $("#networkSpeed").textContent =
      "Offline";

    showToast(
      "Internet connection lost."
    );

  }

}

window.addEventListener(
  "online",
  updateNetworkStatus
);

window.addEventListener(
  "offline",
  updateNetworkStatus
);

/* -----------------------------------------------------
   INIT
----------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {

  loadDraft();
  updateSelectedCount();
  updatePostButton();
  updateNetworkStatus();

});
