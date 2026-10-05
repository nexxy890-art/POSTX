/* =====================================================
   POSTX V2.3
   Frontend Controller
   Supabase Auth Connected
===================================================== */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

/* -----------------------------------------------------
   SUPABASE
----------------------------------------------------- */

const supabaseClient =
  window.supabase.createClient(
    window.POSTX_CONFIG.SUPABASE_URL,
    window.POSTX_CONFIG.SUPABASE_ANON_KEY
  );

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

  uploadJobId: null,
  user: null,
  authMode: "login"
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

const authPanel = $("#authPanel");
const closeAuth = $("#closeAuth");
const authBackdrop = $("#authBackdrop");

const authForm = $("#authForm");
const authEmail = $("#authEmail");
const authPassword = $("#authPassword");

const accountBtn = $("#accountBtn");
const connectionsBtn = $("#connectionsBtn");
const manageAccountsBtn = $("#manageAccountsBtn");

const toast = $("#toast");

/* -----------------------------------------------------
   TOAST
----------------------------------------------------- */

let toastTimer;

function showToast(message) {

  if (!toast) return;

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

  if (!bytes) {
    return "0 MB";
  }

  const mb =
    bytes / (1024 * 1024);

  if (mb < 1024) {
    return `${mb.toFixed(1)} MB`;
  }

  return `${(mb / 1024).toFixed(2)} GB`;
}

/* -----------------------------------------------------
   AUTH MODAL
----------------------------------------------------- */

function openAuth(mode = "login") {

  state.authMode = mode;

  if (!authPanel) return;

  authPanel.classList.remove("hidden");

  updateAuthTabs();

  setTimeout(() => {
    authEmail?.focus();
  }, 100);
}


function closeAuthPanel() {

  authPanel?.classList.add("hidden");

  if (authForm) {
    authForm.reset();
  }
}


function updateAuthTabs() {

  $$(".auth-tab").forEach(tab => {

    tab.classList.toggle(
      "active",
      tab.dataset.auth === state.authMode
    );

  });

  const submitBtn =
    authForm?.querySelector(
      ".auth-submit"
    );

  if (!submitBtn) return;

  submitBtn.innerHTML =
    state.authMode === "login"
      ? "LOGIN →"
      : "CREATE ACCOUNT →";
}


/* -----------------------------------------------------
   AUTH TABS
----------------------------------------------------- */

$$(".auth-tab").forEach(tab => {

  tab.addEventListener("click", () => {

    state.authMode =
      tab.dataset.auth;

    updateAuthTabs();

  });

});


/* -----------------------------------------------------
   CLOSE AUTH
----------------------------------------------------- */

closeAuth?.addEventListener(
  "click",
  closeAuthPanel
);

authBackdrop?.addEventListener(
  "click",
  closeAuthPanel
);


/* -----------------------------------------------------
   SIGN UP / LOGIN
----------------------------------------------------- */

authForm?.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();

    const email =
      authEmail.value.trim();

    const password =
      authPassword.value;

    if (!email || !password) {
      showToast(
        "Email and password are required."
      );
      return;
    }

    if (password.length < 6) {
      showToast(
        "Password must be at least 6 characters."
      );
      return;
    }

    const submitBtn =
      authForm.querySelector(
        ".auth-submit"
      );

    submitBtn.disabled = true;

    submitBtn.textContent =
      state.authMode === "login"
        ? "LOGGING IN..."
        : "CREATING...";


    try {

      let result;

      if (state.authMode === "signup") {

        result =
          await supabaseClient.auth.signUp({
            email,
            password
          });

      } else {

        result =
          await supabaseClient.auth.signInWithPassword({
            email,
            password
          });

      }


      if (result.error) {
        throw result.error;
      }


      if (state.authMode === "signup") {

        if (!result.data.session) {

          showToast(
            "Account created. Check your email to confirm it."
          );

          closeAuthPanel();

        } else {

          state.user =
            result.data.user;

          showToast(
            "Account created successfully."
          );

          closeAuthPanel();

          updateAccountUI();
        }

      } else {

        state.user =
          result.data.user;

        showToast(
          "Login successful."
        );

        closeAuthPanel();

        updateAccountUI();

      }

    } catch (error) {

      console.error(
        "POSTX AUTH ERROR:",
        error
      );

      showToast(
        error.message ||
        "Authentication failed."
      );

    } finally {

      submitBtn.disabled = false;

      updateAuthTabs();

    }

  }
);


/* -----------------------------------------------------
   ACCOUNT UI
----------------------------------------------------- */

function updateAccountUI() {

  if (!accountBtn) return;

  if (state.user) {

    accountBtn.textContent =
      "LOGOUT";

    accountBtn.title =
      state.user.email || "Logged in";

  } else {

    accountBtn.textContent =
      "ACCOUNT";

    accountBtn.title =
      "Login or create an account";

  }


  updatePlatformConnectionText();

}


function updatePlatformConnectionText() {

  const platforms = [
    "youtube",
    "tiktok",
    "instagram",
    "facebook"
  ];

  platforms.forEach(platform => {

    const element =
      $(`#${platform}Account`);

    if (!element) return;

    /*
      Social platform OAuth will be connected
      in the next backend/platform step.
    */

    if (state.user) {

      element.textContent =
        "Ready to connect";

    } else {

      element.textContent =
        "Not connected";

    }

  });

}


/* -----------------------------------------------------
   ACCOUNT BUTTON
----------------------------------------------------- */

accountBtn?.addEventListener(
  "click",
  async () => {

    if (!state.user) {

      closeSettingsPanel();

      openAuth("login");

      return;
    }


    const confirmLogout =
      confirm(
        "Do you want to logout from POSTX?"
      );

    if (!confirmLogout) {
      return;
    }


    const { error } =
      await supabaseClient.auth.signOut();


    if (error) {

      console.error(error);

      showToast(
        "Logout failed."
      );

      return;
    }


    state.user = null;

    closeSettingsPanel();

    updateAccountUI();

    showToast(
      "You have been logged out."
    );

  }
);


/* -----------------------------------------------------
   MANAGE ACCOUNTS
----------------------------------------------------- */

manageAccountsBtn?.addEventListener(
  "click",
  () => {

    if (!state.user) {

      showToast(
        "Please login first."
      );

      openAuth("login");

      return;
    }

    openConnectionsMessage();

  }
);


connectionsBtn?.addEventListener(
  "click",
  () => {

    if (!state.user) {

      closeSettingsPanel();

      openAuth("login");

      return;
    }

    openConnectionsMessage();

  }
);


function openConnectionsMessage() {

  showToast(
    "Platform connections will be added next."
  );

}


/* -----------------------------------------------------
   SETTINGS
----------------------------------------------------- */

function openSettingsPanel() {

  settingsPanel?.classList.remove(
    "hidden"
  );

}


function closeSettingsPanel() {

  settingsPanel?.classList.add(
    "hidden"
  );

}


settingsBtn?.addEventListener(
  "click",
  openSettingsPanel
);


closeSettings?.addEventListener(
  "click",
  closeSettingsPanel
);


const settingsBackdrop =
  settingsPanel?.querySelector(
    ".modal-backdrop"
  );

settingsBackdrop?.addEventListener(
  "click",
  closeSettingsPanel
);


/* -----------------------------------------------------
   VIDEO SELECT
----------------------------------------------------- */

chooseVideoBtn?.addEventListener(
  "click",
  () => {
    videoInput?.click();
  }
);


videoInput?.addEventListener(
  "change",
  () => {

    if (
      videoInput.files &&
      videoInput.files.length
    ) {

      loadVideo(
        videoInput.files[0]
      );

    }

  }
);


/* -----------------------------------------------------
   LOAD VIDEO
----------------------------------------------------- */

function loadVideo(file) {

  if (!file) return;


  if (!file.type.startsWith("video/")) {

    showToast(
      "Please select a video file."
    );

    return;
  }


  state.video = file;


  if (videoPreview.src) {

    URL.revokeObjectURL(
      videoPreview.src
    );

  }


  const url =
    URL.createObjectURL(file);


  videoPreview.src = url;


  uploadPlaceholder.classList.add(
    "hidden"
  );

  videoPreviewBox.classList.remove(
    "hidden"
  );


  videoName.textContent =
    file.name;

  videoSize.textContent =
    formatBytes(file.size);

  fileInfo.textContent =
    `${file.name} • ${formatBytes(file.size)}`;


  videoPreview.addEventListener(
    "loadedmetadata",
    () => {

      const seconds =
        Math.floor(
          videoPreview.duration
        );


      const minutes =
        Math.floor(seconds / 60);


      const remaining =
        seconds % 60;


      fileDuration.textContent =
        `${minutes}:${String(
          remaining
        ).padStart(2, "0")}`;

    },
    {
      once: true
    }
  );


  updatePostButton();

  saveDraft();

}


/* -----------------------------------------------------
   REMOVE VIDEO
----------------------------------------------------- */

removeVideoBtn?.addEventListener(
  "click",
  () => {

    state.video = null;


    videoPreview.pause();

    videoPreview.removeAttribute(
      "src"
    );

    videoPreview.load();


    videoPreviewBox.classList.add(
      "hidden"
    );

    uploadPlaceholder.classList.remove(
      "hidden"
    );


    fileInfo.textContent =
      "No video selected";

    fileDuration.textContent =
      "—";


    if (videoInput) {
      videoInput.value = "";
    }


    updatePostButton();

  }
);


/* -----------------------------------------------------
   DRAG & DROP
----------------------------------------------------- */

["dragenter", "dragover"]
.forEach(eventName => {

  dropZone?.addEventListener(
    eventName,
    event => {

      event.preventDefault();

      dropZone.classList.add(
        "dragover"
      );

    }
  );

});


["dragleave", "drop"]
.forEach(eventName => {

  dropZone?.addEventListener(
    eventName,
    event => {

      event.preventDefault();

      dropZone.classList.remove(
        "dragover"
      );

    }
  );

});


dropZone?.addEventListener(
  "drop",
  event => {

    const file =
      event.dataTransfer.files[0];

    if (file) {
      loadVideo(file);
    }

  }
);


/* -----------------------------------------------------
   CAPTION
----------------------------------------------------- */

captionInput?.addEventListener(
  "input",
  () => {

    captionCount.textContent =
      `${captionInput.value.length} / 2200`;

    saveDraft();

  }
);


/* -----------------------------------------------------
   THUMBNAIL
----------------------------------------------------- */

thumbnailBox?.addEventListener(
  "click",
  () => {
    thumbnailInput?.click();
  }
);


thumbnailInput?.addEventListener(
  "change",
  () => {

    const file =
      thumbnailInput.files[0];

    if (!file) return;


    if (!file.type.startsWith("image/")) {

      showToast(
        "Please select an image."
      );

      return;
    }


    state.thumbnail = file;


    thumbnailPreview.src =
      URL.createObjectURL(file);


    thumbnailPlaceholder.classList.add(
      "hidden"
    );

    thumbnailPreview.classList.remove(
      "hidden"
    );


    saveDraft();

  }
);


/* -----------------------------------------------------
   PLATFORM SELECTION
----------------------------------------------------- */

$$(".platform-card").forEach(card => {

  card.addEventListener(
    "click",
    () => {

      const platform =
        card.dataset.platform;


      if (state.platforms.has(platform)) {

        state.platforms.delete(
          platform
        );

        card.classList.remove(
          "selected"
        );

      } else {

        state.platforms.add(
          platform
        );

        card.classList.add(
          "selected"
        );

      }


      updateSelectedCount();

      updatePostButton();

      saveDraft();

    }
  );

});


/* -----------------------------------------------------
   SELECTED COUNT
----------------------------------------------------- */

function updateSelectedCount() {

  const count =
    state.platforms.size;


  selectedCount.textContent =
    `${count} platform${
      count === 1
        ? ""
        : "s"
    } selected`;

}


/* -----------------------------------------------------
   POST BUTTON
----------------------------------------------------- */

function updatePostButton() {

  const valid =
    !!state.video &&
    state.platforms.size > 0 &&
    !!state.user;


  postBtn.disabled =
    !valid;

}


/* -----------------------------------------------------
   POST EVERYWHERE
----------------------------------------------------- */

postBtn?.addEventListener(
  "click",
  async () => {

    if (!state.user) {

      showToast(
        "Please login to POST EVERYWHERE."
      );

      openAuth("login");

      return;
    }


    if (!state.video) {

      showToast(
        "Video upload is required."
      );

      return;
    }


    if (!state.platforms.size) {

      showToast(
        "Select at least one platform."
      );

      return;
    }


    /*
      IMPORTANT:
      Real backend upload is NOT faked here.
      This will be connected after backend deployment.
    */

    showToast(
      "Upload backend is not connected yet."
    );


    prepareUploadRows();

  }
);


/* -----------------------------------------------------
   UPLOAD ROWS
----------------------------------------------------- */

function prepareUploadRows() {

  $$(".upload-row").forEach(row => {

    const platform =
      row.dataset.uploadPlatform;


    const active =
      state.platforms.has(
        platform
      );


    const stateElement =
      row.querySelector(
        ".upload-state"
      );


    const smallText =
      row.querySelector(
        ".upload-platform small"
      );


    if (active) {

      stateElement.textContent =
        "READY";

      stateElement.className =
        "upload-state";

      if (smallText) {
        smallText.textContent =
          "Ready";
      }

    } else {

      stateElement.textContent =
        "SKIPPED";

      stateElement.className =
        "upload-state waiting";

      if (smallText) {
        smallText.textContent =
          "Skipped";
      }

    }

  });


  $("#overallStatus").textContent =
    "READY";


  $("#totalSize").textContent =
    formatBytes(
      state.video.size
    );

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
    row.querySelector(
      ".progress-bar"
    );


  const percentText =
    row.querySelector(
      ".upload-percent"
    );


  const speedText =
    row.querySelector(
      ".upload-speed"
    );


  const stateText =
    row.querySelector(
      ".upload-state"
    );


  if (bar) {
    bar.style.width =
      `${percent}%`;
  }


  if (percentText) {

    percentText.textContent =
      `${Math.round(percent)}%`;

  }


  if (speedText) {

    speedText.textContent =
      speed || "—";

  }


  if (stateText) {

    stateText.textContent =
      status;

  }

}


/* -----------------------------------------------------
   DRAFT
----------------------------------------------------- */

function saveDraft() {

  const draft = {

    caption:
      captionInput?.value || "",

    platforms:
      [...state.platforms]

  };


  localStorage.setItem(
    "postx_draft",
    JSON.stringify(draft)
  );


  const draftStatus =
    $("#draftStatus");


  if (draftStatus) {

    draftStatus.textContent =
      "DRAFT SAVED";

  }

}


/* -----------------------------------------------------
   LOAD DRAFT
----------------------------------------------------- */

function loadDraft() {

  try {

    const saved =
      JSON.parse(
        localStorage.getItem(
          "postx_draft"
        )
      );


    if (!saved) return;


    if (captionInput) {

      captionInput.value =
        saved.caption || "";

      captionCount.textContent =
        `${captionInput.value.length} / 2200`;

    }


    if (
      Array.isArray(
        saved.platforms
      )
    ) {

      state.platforms =
        new Set(
          saved.platforms
        );


      $$(".platform-card")
      .forEach(card => {

        const platform =
          card.dataset.platform;


        card.classList.toggle(
          "selected",
          state.platforms.has(
            platform
          )
        );

      });

    }


  } catch (error) {

    console.log(
      "No valid draft found."
    );

  }

}


/* -----------------------------------------------------
   NETWORK
----------------------------------------------------- */

function updateNetworkStatus() {

  const networkSpeed =
    $("#networkSpeed");


  if (navigator.onLine) {

    if (networkSpeed) {

      networkSpeed.textContent =
        "Network online";

    }

  } else {

    if (networkSpeed) {

      networkSpeed.textContent =
        "Offline";

    }


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
   SUPABASE SESSION
----------------------------------------------------- */

async function loadCurrentSession() {

  try {

    const {
      data,
      error
    } =
      await 
