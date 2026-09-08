// ======================================================
// 🎬 MOVIFIND - FRONTEND SCRIPT
// Gemini Vision + OMDb + Movie/Drama/Series
// K-Drama + C-Drama + Thai Drama + Web Series
// ======================================================


// ======================================================
// 🌐 API BASE
// ======================================================

// Empty = same server where website is running
const API_BASE = "";


// ======================================================
// 🎭 DISPLAY CONTENT TYPE
// ======================================================

function displayContentType(type) {

    const value = String(type || "unknown")
        .toLowerCase()
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

    const labels = {

        movie: "Movie",
        drama: "Drama",
        series: "Series",
        tv: "TV",
        anime: "Anime",
        documentary: "Documentary",
        "love story": "Love Story",
        "web series": "Web Series",
        "k drama": "K-Drama",
        "c drama": "C-Drama",
        "thai drama": "Thai Drama",
        unknown: "Unknown"

    };

    return labels[value] || "Unknown";
}


// ======================================================
// 🔧 NORMALIZE CONTENT TYPE
// ======================================================

function normalizeContentType(type) {

    const value = String(type || "unknown")
        .toLowerCase()
        .trim()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ");

    const map = {

        movie: "movie",
        film: "movie",
        feature: "movie",
        "feature film": "movie",

        drama: "drama",

        series: "series",
        "tv series": "series",
        "television series": "series",

        tv: "tv",
        "tv show": "tv",
        "television show": "tv",

        anime: "anime",
        "anime series": "anime",

        documentary: "documentary",
        "documentary film": "documentary",

        romance: "love story",
        romantic: "love story",
        "love story": "love story",
        lovestory: "love story",
        "romantic drama": "love story",

        "web series": "web series",
        webseries: "web series",
        "web show": "web series",
        "web drama": "web series",
        "online series": "web series",

        "k drama": "k-drama",
        "k-drama": "k-drama",
        kdrama: "k-drama",
        korean: "k-drama",
        "korean drama": "k-drama",
        "korean series": "k-drama",
        "korean tv series": "k-drama",

        "c drama": "c-drama",
        "c-drama": "c-drama",
        cdrama: "c-drama",
        chinese: "c-drama",
        "chinese drama": "c-drama",
        "chinese series": "c-drama",
        "chinese tv series": "c-drama",

        thai: "thai drama",
        "thai drama": "thai drama",
        thaidrama: "thai drama",
        "thai series": "thai drama",
        "thai tv series": "thai drama",
        "thai bl": "thai drama",

        unknown: "unknown"

    };

    return map[value] || "unknown";
}


// ======================================================
// 🛡️ SAFE DOM GET
// ======================================================

function getElement(id) {

    return document.getElementById(id);

}


// ======================================================
// 🔔 STATUS MESSAGE
// ======================================================

function setStatus(message, type = "info") {

    const result = getElement("result");

    if (!result) {

        console.log(message);

        return;
    }

    let icon = "ℹ️";

    if (type === "success") {
        icon = "✅";
    }

    if (type === "error") {
        icon = "❌";
    }

    if (type === "loading") {
        icon = "⏳";
    }

    result.innerHTML = `

        <p class="movifind-status ${type}">
            ${icon} ${escapeHTML(message)}
        </p>

    `;
}


// ======================================================
// 🎬 SEARCH MOVIE / DRAMA / SERIES
// ======================================================

const movifindSearchCache = new Map();

async function searchMovie() {

    const movieInput = getElement("movieInput");

    const result = getElement("result");

    if (!movieInput) {

        console.error(
            "❌ movieInput element not found."
        );

        return;
    }

    const query = movieInput.value.trim();

    if (!query) {

        setStatus(
            "Please enter a movie, drama or series name first.",
            "error"
        );

        return;
    }

    if (result) {

        result.innerHTML = `

            <p class="movifind-status loading">

                ⏳ Searching for
                "<strong>${escapeHTML(query)}</strong>"...

            </p>

        `;
    }

    try {

        const response = await fetch(

            `${API_BASE}/api/movie?title=${encodeURIComponent(query)}`

        );

        const data = await safeJSON(response);

        if (!response.ok || !data.success) {

            setStatus(

                data.message ||
                "Movie or series not found.",

                "error"

            );

            return;
        }

        renderMovie(data.movie);

    }

    catch (error) {

        console.error(
            "❌ Search error:",
            error
        );

        setStatus(

            "Could not connect to MoviFind server.",

            "error"

        );
    }
}


// ======================================================
// 🎬 FETCH MOVIE DETAILS
// ======================================================

async function fetchMovie(name, detectedInfo = null) {

    const title = String(name || "").trim();

    if (!title) {

        return;
    }

    const result = getElement("result");

    if (result) {

        result.innerHTML = `

            <p class="movifind-status loading">

                ⏳ Loading details for
                "<strong>${escapeHTML(title)}</strong>"...

            </p>

        `;
    }

    try {

        let url =
            `${API_BASE}/api/movie?title=${encodeURIComponent(title)}`;

        // --------------------------------------------------
        // AI INFORMATION
        // --------------------------------------------------

        if (detectedInfo) {

            if (detectedInfo.type) {

                url +=
                    `&type=${encodeURIComponent(
                        detectedInfo.type
                    )}`;
            }

            if (detectedInfo.year) {

                url +=
                    `&year=${encodeURIComponent(
                        detectedInfo.year
                    )}`;
            }

            if (detectedInfo.language) {

                url +=
                    `&language=${encodeURIComponent(
                        detectedInfo.language
                    )}`;
            }
        }

        const response = await fetch(url);

        const data = await safeJSON(response);

        if (!response.ok || !data.success) {

            setStatus(

                data.message ||
                "Content details could not be loaded.",

                "error"

            );

            return;
        }

        const movie = data.movie || {};

        // --------------------------------------------------
        // PRESERVE AI DATA
        // --------------------------------------------------

        if (detectedInfo) {

            const normalizedType =
                normalizeContentType(
                    detectedInfo.type
                );

            if (normalizedType !== "unknown") {

                movie.AIType = normalizedType;

                movie.AITypeLabel =
                    displayContentType(
                        normalizedType
                    );
            }

            if (detectedInfo.year) {

                movie.AIYear =
                    detectedInfo.year;
            }

            if (detectedInfo.language) {

                movie.AILanguage =
                    detectedInfo.language;
            }

            if (
                detectedInfo.confidence !== undefined
            ) {

                movie.AIConfidence =
                    detectedInfo.confidence;
            }
        }

        renderMovie(movie);

    }

    catch (error) {

        console.error(
            "❌ fetchMovie error:",
            error
        );

        setStatus(
            "Server connection failed.",
            "error"
        );
    }
}


// ======================================================
// 🎨 RENDER MOVIE DETAILS
// ======================================================

function renderMovie(movie) {

    const result = getElement("result");

    if (!result) {

        return;
    }

    if (!movie) {

        setStatus(
            "No content data received.",
            "error"
        );

        return;
    }

    // ==================================================
    // 🎭 CONTENT TYPE
    // ==================================================

    let contentType =
        normalizeContentType(

            movie.AIType ||
            movie.AITypeLabel ||
            movie.Type ||
            movie.type

        );

    let contentTypeLabel =
        movie.AITypeLabel ||
        displayContentType(contentType);


    // ==================================================
    // 📅 YEAR
    // ==================================================

    const releaseYear =
        movie.AIYear ||
        movie.Year ||
        "N/A";


    // ==================================================
    // 🌐 LANGUAGE
    // ==================================================

    const language =
        movie.AILanguage ||
        movie.Language ||
        "N/A";


    // ==================================================
    // 🖼️ POSTER
    // ==================================================

    const poster =
        movie.Poster &&
        movie.Poster !== "N/A"
            ? movie.Poster
            : "";


    // ==================================================
    // ⭐ RATING
    // ==================================================

    const rating =
        movie.imdbRating &&
        movie.imdbRating !== "N/A"
            ? movie.imdbRating
            : "N/A";


    // ==================================================
    // 📝 PLOT
    // ==================================================

    const plot =
        movie.Plot &&
        movie.Plot !== "N/A"
            ? movie.Plot
            : "No story information available.";


    // ==================================================
    // 🎭 GENRE
    // ==================================================

    const genre =
        movie.Genre &&
        movie.Genre !== "N/A"
            ? movie.Genre
            : "N/A";


    // ==================================================
    // 🌍 COUNTRY
    // ==================================================

    const country =
        movie.Country &&
        movie.Country !== "N/A"
            ? movie.Country
            : "N/A";


    // ==================================================
    // 🎬 DIRECTOR
    // ==================================================

    const director =
        movie.Director &&
        movie.Director !== "N/A"
            ? movie.Director
            : "N/A";


    // ==================================================
    // ✍️ WRITER
    // ==================================================

    const writer =
        movie.Writer &&
        movie.Writer !== "N/A"
            ? movie.Writer
            : "N/A";


    // ==================================================
    // 👥 ACTORS
    // ==================================================

    const actors =
        movie.Actors &&
        movie.Actors !== "N/A"
            ? movie.Actors
            : "N/A";


    // ==================================================
    // ⏱️ RUNTIME
    // ==================================================

    const runtime =
        movie.Runtime &&
        movie.Runtime !== "N/A"
            ? movie.Runtime
            : "N/A";


    // ==================================================
    // 🏆 AWARDS
    // ==================================================

    const awards =
        movie.Awards &&
        movie.Awards !== "N/A"
            ? movie.Awards
            : "N/A";


    // ==================================================
    // 🎯 AI CONFIDENCE
    // ==================================================

    const confidence =
        movie.AIConfidence !== undefined
            ? movie.AIConfidence
            : movie.confidence;


    const confidenceHTML =

        confidence !== undefined &&
        confidence !== null &&
        confidence !== ""

            ? `

                <div class="movifind-ai-confidence">

                    🎯 AI Confidence:
                    <strong>
                        ${escapeHTML(
                            String(confidence)
                        )}%
                    </strong>

                </div>

            `

            : "";


    // ==================================================
// 🎬 WATCH / SEARCH LINKS
// ==================================================

const contentTitle =
    String(movie.Title || "").trim();

const normalizedType =
    normalizeContentType(
        movie.AIType ||
        movie.AITypeLabel ||
        movie.Type ||
        movie.type
    );

// --------------------------------------------------
// 🌐 VIDEO LANGUAGE OPTIONS
// --------------------------------------------------

const watchLanguages = [
    "English",
    "Hindi",
    "Bangla",
    "Korean",
    "Chinese",
    "Thai",
    "Japanese",
    "Tamil",
    "Telugu",
    "Malayalam",
    "Kannada",
    "Urdu"
];

const detectedLanguage = String(
    movie.AILanguage ||
    movie.Language ||
    ""
).split(",")[0].trim();

const defaultWatchLanguage =
    watchLanguages.find(
        language =>
            detectedLanguage.toLowerCase().includes(
                language.toLowerCase()
            )
    ) || "English";

// --------------------------------------------------
// 🎥 MOVIE / EPISODE SEARCH
// --------------------------------------------------

const watchSearchText =
    normalizedType === "movie"
        ? `${contentTitle} full movie official`
        : `${contentTitle} full episode official`;

const youtubeURL =
    `https://www.youtube.com/results?search_query=${encodeURIComponent(
        watchSearchText
    )}`;

const googleURL =
    `https://www.google.com/search?q=${encodeURIComponent(
        watchSearchText
    )}`;

const whereToWatchURL =
    `https://www.google.com/search?q=${encodeURIComponent(
        `${contentTitle} where to watch official streaming`
    )}`;

// --------------------------------------------------
// ⬇️ PERMITTED DIRECT VIDEO DOWNLOAD
// --------------------------------------------------
// Only show a download button when the backend provides an explicit
// direct/owned video URL. Arbitrary streaming-site ripping is not added.
const directVideoURL =
    movie.DownloadURL ||
    movie.downloadURL ||
    movie.VideoURL ||
    movie.videoURL ||
    "";

function isSafeDirectDownloadURL(value) {
    try {
        const url = new URL(String(value), window.location.origin);
        return (
            url.origin === window.location.origin &&
            (url.pathname.startsWith("/downloads/") ||
             url.pathname.startsWith("/media/") ||
             url.pathname.startsWith("/videos/"))
        );
    } catch {
        return false;
    }
}

const downloadButtonHTML =
    isSafeDirectDownloadURL(directVideoURL)
        ? `
            <a
                href="${escapeAttribute(directVideoURL)}"
                download
                rel="noopener noreferrer"
            >
                ⬇️ Download Video
            </a>
          `
        : "";

// --------------------------------------------------
// 🌐 LANGUAGE SELECTOR + DYNAMIC LINKS
// --------------------------------------------------

function buildYouTubeWatchURL() {

    const selector =
        document.getElementById(
            "movifindWatchLanguage"
        );

    const language =
        selector?.value ||
        defaultWatchLanguage;

    const query =
        normalizedType === "movie"
            ? `${contentTitle} ${language} full movie official`
            : `${contentTitle} ${language} full episode official`;

    return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function buildGoogleWatchURL() {

    const selector =
        document.getElementById(
            "movifindWatchLanguage"
        );

    const language =
        selector?.value ||
        defaultWatchLanguage;

    const query =
        normalizedType === "movie"
            ? `${contentTitle} ${language} full movie official`
            : `${contentTitle} ${language} full episode official`;

    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

function setupWatchLanguageSelector() {

    const buttons =
        result.querySelector(
            ".movie-buttons"
        );

    if (!buttons) return;

    let wrapper =
        result.querySelector(
            ".movifind-watch-language"
        );

    if (!wrapper) {

        wrapper =
            document.createElement("div");

        wrapper.className =
            "movifind-watch-language";

        wrapper.style.cssText = `
            margin: 15px 0;
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
        `;

        wrapper.innerHTML = `
            <label
                for="movifindWatchLanguage"
                style="font-weight:600;"
            >
                🌐 Video Language:
            </label>

            <select
                id="movifindWatchLanguage"
                style="padding:8px 12px;border-radius:8px;cursor:pointer;"
            >
                ${watchLanguages.map(language => `
                    <option
                        value="${escapeAttribute(language)}"
                        ${language === defaultWatchLanguage ? "selected" : ""}
                    >
                        ${escapeHTML(language)}
                    </option>
                `).join("")}
            </select>
        `;

        buttons.parentNode.insertBefore(
            wrapper,
            buttons
        );
    }

    const selector =
        document.getElementById(
            "movifindWatchLanguage"
        );

    const youtubeButton =
        result.querySelector(
            "[data-movifind-youtube]"
        );

    const googleButton =
        result.querySelector(
            "[data-movifind-google]"
        );

    if (selector) {

        selector.addEventListener(
            "change",
            function () {

                if (youtubeButton) {
                    youtubeButton.href =
                        buildYouTubeWatchURL();
                }

                if (googleButton) {
                    googleButton.href =
                        buildGoogleWatchURL();
                }

                console.log(
                    "🌐 Watch language changed:",
                    this.value
                );
            }
        );
    }
}

// 🔎 FOUND MESSAGE
    // ==================================================

    result.innerHTML = `

        <div class="movifind-found-message">

            ✅ Content found!

        </div>


        <div class="movie-card">


            <!-- POSTER -->

            <div class="movie-poster-wrapper">

                ${
                    poster

                        ? `

                            <img

                                class="movie-poster"

                                src="${escapeAttribute(
                                    poster
                                )}"

                                alt="${escapeAttribute(
                                    movie.Title ||
                                    "Poster"
                                )}"

                                onerror="
                                    this.onerror=null;
                                    this.style.display='none';
                                "

                            >

                        `

                        : `

                            <div class="poster-placeholder">

                                🎬

                            </div>

                        `
                }

            </div>


            <!-- INFORMATION -->

            <div class="movie-info">


                <h2>

                    🎬

                    ${escapeHTML(
                        movie.Title ||
                        "Unknown Title"
                    )}

                </h2>


                <!-- IMDb -->

                <div class="movie-rating">

                    ⭐ IMDb:

                    <strong>

                        ${escapeHTML(
                            String(rating)
                        )}

                    </strong>

                </div>


                <!-- AI CONFIDENCE -->

                ${confidenceHTML}


                <!-- DETAILS -->

                <div class="movie-details-grid">


                    <div class="detail-item">

                        <strong>
                            🎭 Content Type
                        </strong>

                        <span>
                            ${escapeHTML(
                                contentTypeLabel
                            )}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            📅 Released
                        </strong>

                        <span>
                            ${escapeHTML(
                                movie.Released ||
                                releaseYear
                            )}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            ⏱️ Runtime
                        </strong>

                        <span>
                            ${escapeHTML(runtime)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            🎭 Genre
                        </strong>

                        <span>
                            ${escapeHTML(genre)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            🌐 Language
                        </strong>

                        <span>
                            ${escapeHTML(language)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            🌍 Country
                        </strong>

                        <span>
                            ${escapeHTML(country)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            🎬 Director
                        </strong>

                        <span>
                            ${escapeHTML(director)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            ✍️ Writer
                        </strong>

                        <span>
                            ${escapeHTML(writer)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            🎥 Actors
                        </strong>

                        <span>
                            ${escapeHTML(actors)}
                        </span>

                    </div>


                    <div class="detail-item">

                        <strong>
                            🏆 Awards
                        </strong>

                        <span>
                            ${escapeHTML(awards)}
                        </span>

                    </div>


                </div>


                <!-- STORY -->

                <div class="movie-story">

                    <h3>
                        📖 Story
                    </h3>

                    <p>
                        ${escapeHTML(plot)}
                    </p>

                </div>


                <!-- BUTTONS -->

<div class="movie-buttons">


    <!-- ▶️ YOUTUBE -->

    <a

        data-movifind-youtube="true"

        href="${escapeAttribute(
            youtubeURL
        )}"

        target="_blank"

        rel="noopener noreferrer"

    >

        ▶ YouTube Full ${
            normalizedType === "movie"
                ? "Movie"
                : "Episode"
        }

    </a>


    <!-- 🔎 GOOGLE -->

    <a

        data-movifind-google="true"

        href="${escapeAttribute(
            googleURL
        )}"

        target="_blank"

        rel="noopener noreferrer"

    >

        🔎 Google Search

    </a>


    <!-- 🎬 WHERE TO WATCH -->

    <a

        href="${escapeAttribute(
            whereToWatchURL
        )}"

        target="_blank"

        rel="noopener noreferrer"

    >

        🎬 Where to Watch

    </a>


    ${downloadButtonHTML}


</div>


            </div>


        </div>

    `;


    // 🌐 Initialize video-language selector after the result card exists.
    setupWatchLanguageSelector();

    console.log(
        "🎬 Rendered:",
        movie.Title
    );

    console.log(
        "🎭 Content Type:",
        contentTypeLabel
    );

}


// ======================================================
// 🖼️ IMAGE INPUT
// ======================================================

const imageInput =
    document.querySelector(
        "input[type='file']"
    );


const previewContainer =
    getElement(
        "imagePreviewContainer"
    );


const previewImage =
    getElement(
        "imagePreview"
    );


// ======================================================
// 📸 IMAGE PREVIEW
// ======================================================

if (imageInput) {

    imageInput.addEventListener(
        "change",
        function () {

            const file =
                this.files &&
                this.files[0];

            if (!file) {

                return;
            }


            // --------------------------------------------------
            // IMAGE TYPE VALIDATION
            // --------------------------------------------------

            if (
                !file.type ||
                !file.type.startsWith(
                    "image/"
                )
            ) {

                setStatus(
                    "Please select an image file.",
                    "error"
                );

                this.value = "";

                return;
            }


            // --------------------------------------------------
            // SIZE LIMIT
            // --------------------------------------------------

            if (
                file.size >
                8 * 1024 * 1024
            ) {

                setStatus(
                    "Image is too large. Maximum size is 8 MB.",
                    "error"
                );

                this.value = "";

                return;
            }


            // --------------------------------------------------
            // PREVIEW
            // --------------------------------------------------

            if (previewImage) {

                const reader =
                    new FileReader();

                reader.onload =
                    function (event) {

                        previewImage.src =
                            event.target.result;

                    };

                reader.readAsDataURL(file);
            }


            if (previewContainer) {

                previewContainer.style.display =
                    "block";
            }


            console.log(
                "📸 Selected image:",
                file.name
            );

        }
    );

}


// ======================================================
// 🤖 GEMINI VISION DETECTION
// ======================================================

let movifindDetectionBusy = false;

async function optimizeImageForVision(file) {
    if (!file || !file.type?.startsWith("image/")) return file;
    try {
        const bitmap = await createImageBitmap(file);
        const maxSide = 1600;
        const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.84));
        return blob ? new File([blob], "movifind.jpg", { type: "image/jpeg" }) : file;
    } catch { return file; }
}

async function handleVisionResult(response) {
    const data = await safeJSON(response);
    if (response.status === 429 || data.quota) {
        setStatus(data.message || "Vision AI quota is temporarily exhausted.", "error");
        return null;
    }
    if (!response.ok || !data.success) {
        setStatus(data.message || "AI could not identify this content.", "error");
        return null;
    }
    const detected = data.movie || {};
    const title = String(detected.title || detected.Title || "").trim();
    const year = String(detected.year || detected.Year || "").trim();
    const language = String(detected.language || detected.Language || "").trim();
    const type = normalizeContentType(detected.type || detected.Type || "unknown");
    const confidence = Number(detected.confidence ?? detected.Confidence ?? 0) || 0;
    if (!title) {
        setStatus("AI could not identify the title. Try a clearer image/video.", "error");
        return null;
    }
    const movieInput = getElement("movieInput");
    if (movieInput) movieInput.value = title;
    showDetectionResult({ title, year, language, type, confidence });
    await fetchMovie(title, { title, year, language, type, confidence });
    return detected;
}

async function detectContent() {
    if (movifindDetectionBusy) return;
    const file = imageInput?.files?.[0];
    if (!file) {
        setStatus("Please upload a movie or drama poster first.", "error");
        return;
    }
    if (!file.type?.startsWith("image/")) {
        setStatus("Only image files are allowed.", "error");
        return;
    }
    if (file.size > 8 * 1024 * 1024) {
        setStatus("Image is too large. Maximum size is 8 MB.", "error");
        return;
    }
    movifindDetectionBusy = true;
    setStatus("🤖 Identifying poster…", "loading");
    try {
        const optimized = await optimizeImageForVision(file);
        const formData = new FormData();
        formData.append("image", optimized);
        const response = await fetch(`${API_BASE}/api/vision`, { method: "POST", body: formData });
        await handleVisionResult(response);
    } catch (error) {
        console.error("❌ Image Vision error:", error);
        setStatus("Could not connect to Vision server.", "error");
    } finally {
        movifindDetectionBusy = false;
    }
}

function getVideoInput() {
    return getElement("videoInput") || document.querySelector("input[type='file'][accept*='video']");
}

async function extractVideoFrames(file) {
    if (!file || !file.type?.startsWith("video/")) {
        throw new Error("Invalid video file.");
    }

    const url = URL.createObjectURL(file);
    const video = document.createElement("video");

    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    try {
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(
                () => reject(new Error("Video metadata timeout.")),
                10000
            );

            video.onloadedmetadata = () => {
                clearTimeout(timeout);
                resolve();
            };

            video.onerror = () => {
                clearTimeout(timeout);
                reject(new Error("Could not read video metadata."));
            };
        });

        const duration = Number(video.duration);

        if (!Number.isFinite(duration)) {
            throw new Error("Invalid video duration.");
        }

        // MoviFind accepts only 5–8 second clips.
        if (duration < 5 || duration > 8) {
            throw new Error(
                `VIDEO_DURATION:${duration.toFixed(2)}`
            );
        }

        const width = video.videoWidth || 960;
        const height = video.videoHeight || 540;
        const scale = Math.min(1, 960 / Math.max(width, height));

        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));

        const ctx = canvas.getContext("2d", { alpha: false });

        if (!ctx) {
            throw new Error("Could not create video canvas.");
        }

        // Four representative frames reduce upload size while keeping
        // enough visual information for title/actor/logo recognition.
        const times = [
            Math.min(0.75, duration * 0.12),
            duration * 0.36,
            duration * 0.64,
            Math.max(0.1, duration - 0.75)
        ];

        const blobs = [];

        for (const time of times) {
            video.currentTime = Math.max(
                0,
                Math.min(time, duration - 0.05)
            );

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(
                    () => reject(new Error("Video frame seek timeout.")),
                    8000
                );

                video.onseeked = () => {
                    clearTimeout(timeout);
                    resolve();
                };

                video.onerror = () => {
                    clearTimeout(timeout);
                    reject(new Error("Could not seek video frame."));
                };
            });

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height
            );

            const blob = await new Promise(resolve => {
                canvas.toBlob(
                    resolve,
                    "image/jpeg",
                    0.70
                );
            });

            if (blob) {
                blobs.push(blob);
            }
        }

        return blobs;
    } finally {
        video.pause();
        video.removeAttribute("src");
        video.load();
        URL.revokeObjectURL(url);
    }
}

async function detectContentFromVideo() {
    if (movifindDetectionBusy) return;

    const input = getVideoInput();
    const file = input?.files?.[0];

    if (!file) {
        setStatus(
            "Please upload a 5–8 second video first.",
            "error"
        );
        return;
    }

    if (!file.type?.startsWith("video/")) {
        setStatus(
            "Please select a video file.",
            "error"
        );
        return;
    }

    if (file.size > 25 * 1024 * 1024) {
        setStatus(
            "Video is too large. Maximum size is 25 MB.",
            "error"
        );
        return;
    }

    movifindDetectionBusy = true;

    setStatus(
        "🎥 Checking 5–8 second video…",
        "loading"
    );

    try {
        const frames = await extractVideoFrames(file);

        if (!frames.length) {
            throw new Error("No frames extracted.");
        }

        const formData = new FormData();

        frames.forEach((blob, index) => {
            formData.append(
                "images",
                blob,
                `movifind-frame-${index + 1}.jpg`
            );
        });

        setStatus(
            "🤖 AI is identifying the movie from video frames…",
            "loading"
        );

        const response = await fetch(
            `${API_BASE}/api/vision-frames`,
            {
                method: "POST",
                body: formData
            }
        );

        await handleVisionResult(response);
    } catch (error) {
        console.error(
            "❌ Video Vision error:",
            error
        );

        if (String(error?.message || "").startsWith("VIDEO_DURATION:")) {
            const seconds = String(error.message).split(":")[1];

            setStatus(
                `Video duration is ${seconds} seconds. Please upload a video between 5 and 8 seconds.`,
                "error"
            );
        } else {
            setStatus(
                "Could not analyze this video. Please try a clear 5–8 second clip.",
                "error"
            );
        }
    } finally {
        movifindDetectionBusy = false;
    }
}

// Add video controls without replacing index.html.
(function setupVideoDetection() {
    const detect = getElement("detectButton");
    let input = getVideoInput();

    if (!input && !detect) return;

    if (!input) {
        input = document.createElement("input");
        input.type = "file";
        input.id = "videoInput";
        input.accept = "video/mp4,video/webm,video/ogg,video/quicktime";
        input.style.display = "none";
        document.body.appendChild(input);
    }

    if (!getElement("videoDetectButton")) {
        const button = document.createElement("button");

        button.type = "button";
        button.id = "videoDetectButton";
        button.className = "movifind-action-btn video-detect-btn";
        button.textContent = "🎬 Upload 5–8 Second Video";

        button.addEventListener(
            "click",
            () => input.click()
        );

        if (detect?.parentNode) {
            detect.parentNode.appendChild(button);
        } else {
            document.body.appendChild(button);
        }
    }

    if (!input.dataset.movifindVideoBound) {
        input.addEventListener(
            "change",
            detectContentFromVideo
        );

        input.dataset.movifindVideoBound = "true";
    }
})();

// ======================================================
// 🎭 SHOW AI DETECTION RESULT
// ======================================================

function showDetectionResult(info) {

    const container =
        getElement(
            "detectedResult"
        );


    const title =
        escapeHTML(
            info.title ||
            "Unknown"
        );


    const type =
        escapeHTML(
            displayContentType(
                info.type
            )
        );


    const year =
        escapeHTML(
            info.year ||
            "N/A"
        );


    const language =
        escapeHTML(
            info.language ||
            "N/A"
        );


    const confidence =
        escapeHTML(
            String(
                info.confidence ||
                0
            )
        );


    // ==================================================
    // IF HTML HAS detectedResult
    // ==================================================

    if (container) {

        container.innerHTML = `

            <div class="ai-detection-card">


                <div>

                    ✅ Detected:

                    <strong>
                        ${title}
                    </strong>

                </div>


                <div>

                    🎭 Type:

                    <strong>
                        ${type}
                    </strong>

                </div>


                <div>

                    📅 Year:

                    <strong>
                        ${year}
                    </strong>

                </div>


                <div>

                    🌐 Language:

                    <strong>
                        ${language}
                    </strong>

                </div>


                <div>

                    🎯 Confidence:

                    <strong>
                        ${confidence}%
                    </strong>

                </div>


            </div>

        `;

        return;
    }


    // ==================================================
    // FALLBACK DETECTION BOX
    // ==================================================

    const result =
        getElement(
            "result"
        );


    if (!result) {

        return;
    }


    const existing =
        document.getElementById(
            "movifindAutoDetection"
        );


    if (existing) {

        existing.remove();
    }


    const detection =
        document.createElement(
            "div"
        );


    detection.id =
        "movifindAutoDetection";


    detection.className =
        "ai-detection-card";


    detection.innerHTML = `

        <div>

            ✅ Detected:

            <strong>
                ${title}
            </strong>

        </div>


        <div>

            🎭 Type:

            <strong>
                ${type}
            </strong>

        </div>


        <div>

            📅 Year:

            <strong>
                ${year}
            </strong>

        </div>


        <div>

            🌐 Language:

            <strong>
                ${language}
            </strong>

        </div>


        <div>

            🎯 Confidence:

            <strong>
                ${confidence}%
            </strong>

        </div>

    `;


    result.parentNode.insertBefore(
        detection,
        result
    );

}


// ======================================================
// 🧹 ESCAPE HTML
// ======================================================

function escapeHTML(value) {

    return String(value ?? "")

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
        );

}


// ======================================================
// 🔐 ESCAPE ATTRIBUTE
// ======================================================

function escapeAttribute(value) {

    return escapeHTML(value);

}


// ======================================================
// 📦 SAFE JSON RESPONSE
// ======================================================

async function safeJSON(response) {

    const text =
        await response.text();

    try {

        return JSON.parse(text);

    }

    catch (error) {

        console.error(
            "❌ Invalid server response:",
            text
        );

        return {

            success: false,

            message:
                "Server returned an invalid response."

        };

    }

}


// ======================================================
// 🔍 ENTER KEY SEARCH
// ======================================================

const movieInput =
    getElement(
        "movieInput"
    );


if (movieInput) {

    movieInput.addEventListener(

        "keypress",

        function (event) {

            if (
                event.key ===
                "Enter"
            ) {

                event.preventDefault();

                searchMovie();

            }

        }

    );

}


// ======================================================
// 🔘 DETECT BUTTON
// ======================================================

const detectButton =
    getElement(
        "detectButton"
    );


if (detectButton) {

    detectButton.addEventListener(

        "click",

        function () {

            detectContent();

        }

    );

}


// ======================================================
// 🔘 SEARCH BUTTON
// ======================================================

const searchButton =
    getElement(
        "searchButton"
    );


if (searchButton) {

    searchButton.addEventListener(

        "click",

        function () {

            searchMovie();

        }

    );

}


// ======================================================
// 🌐 SERVER HEALTH CHECK
// ======================================================

async function checkServerHealth() {

    try {

        const response =
            await fetch(

                `${API_BASE}/api/health`

            );


        const data =
            await safeJSON(response);


        if (data.success) {

            console.log(
                "🟢 MoviFind Server: ONLINE"
            );


            console.log(
                "🔎 OMDb:",
                data.omdb
                    ? "READY"
                    : "MISSING"
            );


            console.log(
                "🤖 Gemini:",
                data.gemini
                    ? "READY"
                    : "MISSING"
            );


            console.log(
                "🎭 Supported:",
                data.supportedContent
            );


            if (data.geminiModel) {

                console.log(
                    "🧠 Vision Model:",
                    data.geminiModel
                );

            }


            if (data.geminiFallbackModel) {

                console.log(
                    "🔁 Fallback Model:",
                    data.geminiFallbackModel
                );

            }


            return true;

        }

    }

    catch (error) {

        console.warn(
            "🔴 MoviFind Server is not reachable."
        );


        console.warn(
            "Start server with: node server.js"
        );

    }


    return false;

}


// ======================================================
// 🚀 STARTUP
// ======================================================

console.log(
    "========================================"
);


console.log(
    "🎬 MOVIFIND FRONTEND STARTED"
);


console.log(
    "🤖 Gemini Vision: ENABLED"
);


console.log(
    "🔎 OMDb Search: ENABLED"
);


console.log(
    "🎭 Movie: ENABLED"
);


console.log(
    "🎭 Drama: ENABLED"
);


console.log(
    "📺 Series: ENABLED"
);


console.log(
    "🎭 K-Drama: ENABLED"
);


console.log(
    "🎭 C-Drama: ENABLED"
);


console.log(
    "🎭 Thai Drama: ENABLED"
);


console.log(
    "📺 Web Series: ENABLED"
);


console.log(
    "========================================"
);


// ======================================================
// START HEALTH CHECK
// ======================================================

checkServerHealth();