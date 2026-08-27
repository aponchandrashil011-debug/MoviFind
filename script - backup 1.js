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
    // 🕘 SAVE SEARCH HISTORY
    // ==================================================

    addMoviFindHistory(movie);
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

// ==================================================
// 🌐 VIDEO LANGUAGE OPTIONS
// ==================================================

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
            detectedLanguage
                .toLowerCase()
                .includes(
                    language.toLowerCase()
                )
    ) || "English";

// ==================================================
// 🔎 SEARCH QUERY
// ==================================================

// ==================================================
// 🔎 SMART YOUTUBE SEARCH QUERY
// ==================================================

function getWatchSearchQuery(language) {

    const selectedLanguage =
        String(
            language || defaultWatchLanguage || "English"
        ).trim();

    const title =
        String(
            contentTitle || ""
        ).trim();

    // --------------------------------------------------
    // 🎬 MOVIE
    // --------------------------------------------------

    if (normalizedType === "movie") {

        return [
            title,
            selectedLanguage,
            "full movie",
            "official"
        ]
            .filter(Boolean)
            .join(" ");
    }

    // --------------------------------------------------
    // 📺 DRAMA / SERIES
    // --------------------------------------------------

    return [
        title,
        selectedLanguage,
        "full episode",
        "official"
    ]
        .filter(Boolean)
        .join(" ");
}

// ==================================================
// ▶️ YOUTUBE URL
// ==================================================

// ==================================================
// ▶️ SMART YOUTUBE URL
// ==================================================

function buildYouTubeWatchURL() {

    const selector =
        document.getElementById(
            "movifindWatchLanguage"
        );

    const language =
        selector?.value ||
        defaultWatchLanguage ||
        "English";

    const query =
        getWatchSearchQuery(language);

    const youtubeURL =
        "https://www.youtube.com/results?search_query=" +
        encodeURIComponent(query);

    console.log(
        "▶️ YouTube Search:",
        query
    );

    return youtubeURL;
}

// ==================================================
// 🔎 GOOGLE URL
// ==================================================

// ==================================================
// 🔎 GOOGLE SEARCH URL
// ==================================================

function buildGoogleWatchURL() {

    const selector =
        document.getElementById(
            "movifindWatchLanguage"
        );

    const language =
        selector?.value ||
        defaultWatchLanguage ||
        "English";

    const title =
        String(
            contentTitle || ""
        ).trim();

    const query =
        [
            title,
            language,
            normalizedType === "movie"
                ? "full movie"
                : "full episode",
            "official"
        ]
            .filter(Boolean)
            .join(" ");

    const url =
        "https://www.google.com/search?q=" +
        encodeURIComponent(query);

    console.log(
        "🔎 Google Search:",
        query
    );

    return url;
}

// ==================================================
// 🎬 WHERE TO WATCH URL
// ==================================================

// ==================================================
// 🎬 WHERE TO WATCH
// ==================================================

function buildWhereToWatchURL() {

    const selector =
        document.getElementById(
            "movifindWatchLanguage"
        );

    const language =
        selector?.value ||
        defaultWatchLanguage ||
        "English";

    const title =
        String(
            contentTitle || ""
        ).trim();

    const contentKind =
        normalizedType === "movie"
            ? "movie"
            : "series drama";

    const query =
        [
            title,
            language,
            contentKind,
            "where to watch",
            "official streaming"
        ]
            .filter(Boolean)
            .join(" ");

    const url =
        "https://www.google.com/search?q=" +
        encodeURIComponent(query);

    console.log(
        "🎬 Where to Watch:",
        query
    );

    return url;
}

// ==================================================
// 🌐 LANGUAGE SELECTOR
// ==================================================

function setupWatchLanguageSelector() {

    const buttons =
        result.querySelector(
            ".movie-buttons"
        );

    if (!buttons) {
        return;
    }

    const oldWrapper =
        result.querySelector(
            ".movifind-watch-language"
        );

    if (oldWrapper) {
        oldWrapper.remove();
    }

    const wrapper =
        document.createElement("div");

    wrapper.className =
        "movifind-watch-language";

    wrapper.style.cssText = `
        margin:15px 0;
        display:flex;
        align-items:center;
        gap:10px;
        flex-wrap:wrap;
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
            style="
                padding:8px 12px;
                border-radius:8px;
                cursor:pointer;
            "
        >

            ${watchLanguages.map(language => `

                <option
                    value="${escapeAttribute(language)}"
                    ${
                        language ===
                        defaultWatchLanguage
                            ? "selected"
                            : ""
                    }
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
    const whereToWatchButton =
    result.querySelector(
        "[data-movifind-where]"
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
                
              
                if (whereToWatchButton) {

                     whereToWatchButton.href =
                        buildWhereToWatchURL();

                }
                
                console.log(
                    "🌐 Video language changed:",
                    this.value
                );

            }
        );

    }

}

    // ==================================================
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
    <!-- ❤️ FAVORITE -->

<button
    type="button"
    data-movifind-favorite="true"
    style="
        border:none;
        background:#e91e63;
        color:#fff;
        padding:8px 12px;
        border-radius:6px;
        cursor:pointer;
        font-size:11px;
    "
>
    ❤️ Favorite
</button>


<!-- 📺 WATCHLIST -->

<button
    type="button"
    data-movifind-watchlist="true"
    style="
        border:none;
        background:#1976d2;
        color:#fff;
        padding:8px 12px;
        border-radius:6px;
        cursor:pointer;
        font-size:11px;
    "
>
    📺 Watchlist
</button>

    <!-- ▶️ YOUTUBE -->

    <a
        data-movifind-youtube="true"
        href="${escapeAttribute(
            buildYouTubeWatchURL()
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
            buildGoogleWatchURL()
        )}"
        target="_blank"
        rel="noopener noreferrer"
    >

        🔎 Google Search

    </a>


    <!-- 🎬 WHERE TO WATCH -->

    <a  
        data-movifind-where="true"
        href="${escapeAttribute( 
    buildWhereToWatchURL() 
     )}"
        target="_blank"
        rel="noopener noreferrer"
    >

        🎬 Where to Watch

    </a>
    <!-- 🍿 JUSTWATCH -->

    <a
        href="https://www.justwatch.com/search?q=${encodeURIComponent(movie.Title)}"
        target="_blank"
        rel="noopener noreferrer"
    >

        🍿 JustWatch

    </a>


    <!-- 📺 NETFLIX -->

    <a
        href="https://www.netflix.com/search?q=${encodeURIComponent(movie.Title)}"
        target="_blank"
        rel="noopener noreferrer"
    >

        📺 Netflix

    </a>


    <!-- 🎥 PRIME VIDEO -->

    <a
        href="https://www.primevideo.com/search/ref=atv_nb_sr?phrase=${encodeURIComponent(movie.Title)}"
        target="_blank"
        rel="noopener noreferrer"
    >

        🎥 Prime Video

    </a>


    <!-- ⭐ DISNEY+ -->

    <a
        href="https://www.disneyplus.com/search/${encodeURIComponent(movie.Title)}"
        target="_blank"
        rel="noopener noreferrer"
    >

        ⭐ Disney+

    </a>


    <!-- 🌸 CRUNCHYROLL -->

    <a
        href="https://www.crunchyroll.com/search?q=${encodeURIComponent(movie.Title)}"
        target="_blank"
        rel="noopener noreferrer"
    >

        🌸 Crunchyroll

    </a>
</div>


            </div>


        </div>

    `;


    console.log(
        "🎬 Rendered:",
        movie.Title
    );

    console.log(
        "🎭 Content Type:",
        contentTypeLabel
    );
// ==================================================
// 🌐 SHOW VIDEO LANGUAGE SELECTOR
// ==================================================

setupWatchLanguageSelector();
// ==================================================
// ❤️ FAVORITE BUTTON
// ==================================================

const favoriteButton =
    result.querySelector(
        "[data-movifind-favorite]"
    );

if (favoriteButton) {

    favoriteButton.addEventListener(
        "click",
        function () {

            addMoviFindFavorite(
                movie
            );

        }
    );
}


// ==================================================
// 📺 WATCHLIST BUTTON
// ==================================================

const watchlistButton =
    result.querySelector(
        "[data-movifind-watchlist]"
    );

if (watchlistButton) {

    watchlistButton.addEventListener(
        "click",
        function () {

            addMoviFindWatchlist(
                movie
            );

        }
    );
}


// ==================================================
// 📚 UPDATE LIBRARY
// ==================================================

updateMoviFindLibraryUI();
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

async function detectContent() {

    if (!imageInput) {

        setStatus(
            "Image upload input was not found.",
            "error"
        );

        return;
    }


    const file =
        imageInput.files &&
        imageInput.files[0];


    if (!file) {

        setStatus(
            "Please upload a movie or drama poster first.",
            "error"
        );

        return;
    }


    // --------------------------------------------------
    // VALIDATE IMAGE
    // --------------------------------------------------

    if (
        !file.type ||
        !file.type.startsWith(
            "image/"
        )
    ) {

        setStatus(
            "Only image files are allowed.",
            "error"
        );

        return;
    }


    if (
        file.size >
        8 * 1024 * 1024
    ) {

        setStatus(
            "Image is too large. Maximum size is 8 MB.",
            "error"
        );

        return;
    }


    const result =
        getElement("result");


    if (result) {

        result.innerHTML = `

            <p class="movifind-status loading">

                🤖 AI is analyzing the poster...

                <br>

                <small>

                    This may take a few seconds.

                </small>

            </p>

        `;
    }


    console.log("");

    console.log(
        "📸 Sending image to Gemini Vision..."
    );


    try {

        const formData =
            new FormData();


        formData.append(
            "image",
            file
        );


        const response =
            await fetch(

                `${API_BASE}/api/vision`,

                {

                    method: "POST",

                    body: formData

                }

            );


        const data =
            await safeJSON(response);


        console.log(
            "🤖 Vision response:",
            data
        );


        // ==================================================
        // 🚫 QUOTA ERROR
        // ==================================================

        if (
            response.status === 429 ||
            data.quota
        ) {

            setStatus(

                data.message ||
                "Gemini Vision quota is temporarily exhausted.",

                "error"

            );

            return;
        }


        // ==================================================
        // ❌ GENERAL ERROR
        // ==================================================

        if (
            !response.ok ||
            !data.success
        ) {

            setStatus(

                data.message ||
                "AI could not identify this poster.",

                "error"

            );

            return;
        }


        // ==================================================
        // 🎬 DETECTED DATA
        // ==================================================

        const detected =
            data.movie ||
            {};


        const title =
            String(

                detected.title ||
                detected.Title ||
                ""

            ).trim();


        const year =
            String(

                detected.year ||
                detected.Year ||
                ""

            ).trim();


        const language =
            String(

                detected.language ||
                detected.Language ||
                ""

            ).trim();


        const type =
            normalizeContentType(

                detected.type ||
                detected.Type ||
                "unknown"

            );


        const confidence =
            Number(

                detected.confidence ||
                detected.Confidence ||
                0

            );


        // ==================================================
        // ❌ TITLE NOT FOUND
        // ==================================================

        if (!title) {

            setStatus(

                "AI could not identify the title from this poster. Try a clearer poster.",

                "error"

            );

            return;
        }


        // ==================================================
        // 🔎 PUT TITLE INTO SEARCH BOX
        // ==================================================

        const movieInput =
            getElement(
                "movieInput"
            );


        if (movieInput) {

            movieInput.value =
                title;
        }


        // ==================================================
        // 🎭 SHOW DETECTION
        // ==================================================

        showDetectionResult({

            title,
            year,
            language,
            type,
            confidence

        });


        // ==================================================
        // 🧾 LOG
        // ==================================================

        console.log(
            "========================================"
        );

        console.log(
            "✅ AI DETECTED"
        );

        console.log(
            "🎬 Title:",
            title
        );

        console.log(
            "🎭 Type:",
            displayContentType(type)
        );

        console.log(
            "📅 Year:",
            year
        );

        console.log(
            "🌐 Language:",
            language
        );

        console.log(
            "🎯 Confidence:",
            confidence + "%"
        );

        console.log(
            "========================================"
        );


        // ==================================================
        // 🔎 GET OMDb DETAILS
        // ==================================================

        await fetchMovie(

            title,

            {

                title,
                year,
                language,
                type,
                confidence

            }

        );

    }


    catch (error) {

        console.error(
            "❌ Vision frontend error:",
            error
        );

        setStatus(

            "Could not connect to Gemini Vision server.",

            "error"

        );
    }

}


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
                data.contentDetection ||
                data.supportedTypes ||
                []
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
// ======================================================
// ❤️ MOVIFIND - FAVORITES / WATCHLIST / SEARCH HISTORY
// ======================================================

const MOVIFIND_STORAGE = {
    favorites: "movifind_favorites",
    watchlist: "movifind_watchlist",
    history: "movifind_search_history"
};


// ======================================================
// 💾 STORAGE HELPERS
// ======================================================

function movifindGetStorage(key) {

    try {

        return JSON.parse(
            localStorage.getItem(key) || "[]"
        );

    } catch (error) {

        console.error(
            "MoviFind storage read error:",
            error
        );

        return [];
    }
}


function movifindSetStorage(key, data) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(data)
        );

        return true;

    } catch (error) {

        console.error(
            "MoviFind storage save error:",
            error
        );

        return false;
    }
}


// ======================================================
// 🎬 CREATE MOVIE STORAGE OBJECT
// ======================================================

function movifindMovieObject(movie) {

    if (!movie) {
        return null;
    }

    return {

        imdbID:
            String(
                movie.imdbID ||
                ""
            ).trim(),

        Title:
            String(
                movie.Title ||
                ""
            ).trim(),

        Year:
            String(
                movie.Year ||
                movie.AIYear ||
                ""
            ).trim(),

        Poster:
            String(
                movie.Poster ||
                ""
            ).trim(),

        Type:
            String(
                movie.AITypeLabel ||
                movie.AIType ||
                movie.Type ||
                movie.type ||
                ""
            ).trim(),

        Genre:
            String(
                movie.Genre ||
                ""
            ).trim(),

        Language:
            String(
                movie.AILanguage ||
                movie.Language ||
                ""
            ).trim(),

        imdbRating:
            String(
                movie.imdbRating ||
                ""
            ).trim(),

        Plot:
            String(
                movie.Plot ||
                ""
            ).trim(),

        savedAt:
            Date.now()
    };
}


// ======================================================
// 🔑 MOVIE UNIQUE ID
// ======================================================

function movifindMovieKey(movie) {

    if (!movie) {
        return "";
    }

    return String(
        movie.imdbID ||
        movie.Title ||
        ""
    )
        .trim()
        .toLowerCase();
}


// ======================================================
// ❤️ FAVORITE
// ======================================================

function addMoviFindFavorite(movie) {

    const item =
        movifindMovieObject(movie);

    if (!item || !item.Title) {

        return;
    }

    const favorites =
        movifindGetStorage(
            MOVIFIND_STORAGE.favorites
        );

    const key =
        movifindMovieKey(item);

    const exists =
        favorites.some(
            movie =>
                movifindMovieKey(movie) === key
        );

    if (exists) {

        showMoviFindMessage(
            "❤️ Already in Favorites."
        );

        return;
    }

    favorites.unshift(item);

    movifindSetStorage(
        MOVIFIND_STORAGE.favorites,
        favorites
    );

    showMoviFindMessage(
        `❤️ ${item.Title} added to Favorites.`
    );

    updateMoviFindLibraryUI();
}


// ======================================================
// ❌ REMOVE FAVORITE
// ======================================================

function removeMoviFindFavorite(key) {

    const favorites =
        movifindGetStorage(
            MOVIFIND_STORAGE.favorites
        );

    const updated =
        favorites.filter(
            movie =>
                movifindMovieKey(movie) !==
                String(key)
                    .toLowerCase()
        );

    movifindSetStorage(
        MOVIFIND_STORAGE.favorites,
        updated
    );

    updateMoviFindLibraryUI();
}


// ======================================================
// 📺 WATCHLIST
// ======================================================

function addMoviFindWatchlist(movie) {

    const item =
        movifindMovieObject(movie);

    if (!item || !item.Title) {

        return;
    }

    const watchlist =
        movifindGetStorage(
            MOVIFIND_STORAGE.watchlist
        );

    const key =
        movifindMovieKey(item);

    const exists =
        watchlist.some(
            movie =>
                movifindMovieKey(movie) === key
        );

    if (exists) {

        showMoviFindMessage(
            "📺 Already in Watchlist."
        );

        return;
    }

    watchlist.unshift(item);

    movifindSetStorage(
        MOVIFIND_STORAGE.watchlist,
        watchlist
    );

    showMoviFindMessage(
        `📺 ${item.Title} added to Watchlist.`
    );

    updateMoviFindLibraryUI();
}


// ======================================================
// ❌ REMOVE WATCHLIST
// ======================================================

function removeMoviFindWatchlist(key) {

    const watchlist =
        movifindGetStorage(
            MOVIFIND_STORAGE.watchlist
        );

    const updated =
        watchlist.filter(
            movie =>
                movifindMovieKey(movie) !==
                String(key)
                    .toLowerCase()
        );

    movifindSetStorage(
        MOVIFIND_STORAGE.watchlist,
        updated
    );

    updateMoviFindLibraryUI();
}


// ======================================================
// 🕘 SEARCH HISTORY
// ======================================================

function addMoviFindHistory(movie) {

    const item =
        movifindMovieObject(movie);

    if (!item || !item.Title) {

        return;
    }

    let history =
        movifindGetStorage(
            MOVIFIND_STORAGE.history
        );

    const key =
        movifindMovieKey(item);

    // Remove duplicate
    history =
        history.filter(
            movie =>
                movifindMovieKey(movie) !== key
        );

    // Newest first
    history.unshift(item);

    // Keep last 20 searches
    history =
        history.slice(0, 20);

    movifindSetStorage(
        MOVIFIND_STORAGE.history,
        history
    );

    updateMoviFindLibraryUI();
}


// ======================================================
// 🧹 CLEAR HISTORY
// ======================================================

function clearMoviFindHistory() {

    localStorage.removeItem(
        MOVIFIND_STORAGE.history
    );

    updateMoviFindLibraryUI();

    showMoviFindMessage(
        "🧹 Search history cleared."
    );
}


// ======================================================
// 🔔 SMALL MESSAGE
// ======================================================

function showMoviFindMessage(message) {

    let box =
        document.getElementById(
            "movifindLibraryMessage"
        );

    if (!box) {

        box =
            document.createElement("div");

        box.id =
            "movifindLibraryMessage";

        box.style.cssText = `
            position:fixed;
            left:50%;
            bottom:25px;
            transform:translateX(-50%);
            background:#24242d;
            color:#ffffff;
            padding:10px 16px;
            border-radius:8px;
            border:1px solid #464653;
            font-size:13px;
            z-index:99999;
            box-shadow:0 5px 20px rgba(0,0,0,.4);
        `;

        document.body.appendChild(box);
    }

    box.textContent =
        message;

    box.style.display =
        "block";

    clearTimeout(
        box._timer
    );

    box._timer =
        setTimeout(
            function () {

                box.style.display =
                    "none";

            },
            2500
        );
}


// ======================================================
// 📚 LIBRARY PANEL
// ======================================================

function createMoviFindLibraryUI() {

    if (
        document.getElementById(
            "movifindLibrary"
        )
    ) {

        return;
    }

    const container =
        document.querySelector(
            ".movifind-container"
        );

    if (!container) {

        return;
    }

    const library =
        document.createElement("section");

    library.id =
        "movifindLibrary";

    library.style.cssText = `
        margin-top:25px;
        padding:15px;
        background:#17171d;
        border:1px solid #34343e;
        border-radius:12px;
    `;

    library.innerHTML = `

        <div style="
            display:flex;
            justify-content:center;
            gap:8px;
            flex-wrap:wrap;
            margin-bottom:15px;
        ">

            <button
                type="button"
                data-library-tab="favorites"
                class="movifind-library-tab"
            >
                ❤️ Favorites
            </button>

            <button
                type="button"
                data-library-tab="watchlist"
                class="movifind-library-tab"
            >
                📺 Watchlist
            </button>

            <button
                type="button"
                data-library-tab="history"
                class="movifind-library-tab"
            >
                🕘 History
            </button>

        </div>

        <div id="movifindLibraryContent"></div>

    `;

    container.appendChild(
        library
    );

    library
        .querySelectorAll(
            "[data-library-tab]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        renderMoviFindLibrary(
                            this.dataset.libraryTab
                        );

                    }
                );

            }
        );

    renderMoviFindLibrary(
        "favorites"
    );
}


// ======================================================
// 📚 RENDER LIBRARY
// ======================================================

function renderMoviFindLibrary(
    section = "favorites"
) {

    const content =
        document.getElementById(
            "movifindLibraryContent"
        );

    if (!content) {

        return;
    }

    let items = [];

    if (section === "favorites") {

        items =
            movifindGetStorage(
                MOVIFIND_STORAGE.favorites
            );

    }

    if (section === "watchlist") {

        items =
            movifindGetStorage(
                MOVIFIND_STORAGE.watchlist
            );

    }

    if (section === "history") {

        items =
            movifindGetStorage(
                MOVIFIND_STORAGE.history
            );

    }

    const titleMap = {

        favorites:
            "❤️ Your Favorites",

        watchlist:
            "📺 Your Watchlist",

        history:
            "🕘 Search History"

    };

    const emptyMap = {

        favorites:
            "No favorite movies yet.",

        watchlist:
            "Your Watchlist is empty.",

        history:
            "No search history yet."

    };

    let html = `

        <div style="
            display:flex;
            justify-content:space-between;
            align-items:center;
            gap:10px;
            flex-wrap:wrap;
            margin-bottom:12px;
        ">

            <h3 style="
                margin:0;
                color:#ff9800;
                font-size:16px;
            ">
                ${titleMap[section]}
            </h3>

            ${
                section === "history" &&
                items.length
                    ? `
                        <button
                            type="button"
                            id="movifindClearHistory"
                            style="
                                border:none;
                                background:#9c22c4;
                                color:white;
                                padding:7px 10px;
                                border-radius:6px;
                                cursor:pointer;
                                font-size:11px;
                            "
                        >
                            🧹 Clear History
                        </button>
                    `
                    : ""
            }

        </div>

    `;

    if (!items.length) {

        html += `

            <div style="
                text-align:center;
                padding:20px 10px;
                color:#aaa;
                font-size:12px;
            ">
                ${emptyMap[section]}
            </div>

        `;

        content.innerHTML =
            html;

        return;
    }

    html += `

        <div style="
            display:grid;
            grid-template-columns:
                repeat(auto-fill,minmax(170px,1fr));
            gap:10px;
        ">

    `;

    items.forEach(
        function (movie) {

            const key =
                escapeAttribute(
                    movifindMovieKey(movie)
                );

            const poster =
                movie.Poster &&
                movie.Poster !== "N/A"
                    ? `
                        <img
                            src="${escapeAttribute(movie.Poster)}"
                            alt="${escapeAttribute(movie.Title)}"
                            style="
                                width:70px;
                                height:100px;
                                object-fit:cover;
                                border-radius:6px;
                                display:block;
                                margin:0 auto 8px;
                            "
                            onerror="
                                this.style.display='none';
                            "
                        >
                    `
                    : `
                        <div style="
                            width:70px;
                            height:100px;
                            margin:0 auto 8px;
                            border-radius:6px;
                            background:#24242d;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            font-size:25px;
                        ">
                            🎬
                        </div>
                    `;

            html += `

                <div style="
                    background:#202027;
                    border-radius:8px;
                    padding:10px;
                    text-align:center;
                ">

                    ${poster}

                    <strong style="
                        display:block;
                        color:#ffffff;
                        font-size:12px;
                        line-height:1.4;
                    ">
                        ${escapeHTML(movie.Title)}
                    </strong>

                    <div style="
                        color:#aaa;
                        font-size:10px;
                        margin:5px 0;
                    ">
                        ${escapeHTML(movie.Year || "N/A")}
                    </div>

                    <button
                        type="button"
                        data-open-moviefind="${key}"
                        style="
                            border:none;
                            background:#ff9800;
                            color:#111;
                            padding:5px 8px;
                            border-radius:5px;
                            cursor:pointer;
                            font-size:10px;
                            margin:2px;
                        "
                    >
                        🔎 Open
                    </button>

                    <button
                        type="button"
                        data-remove-moviefind="${key}"
                        data-remove-section="${section}"
                        style="
                            border:none;
                            background:#9c22c4;
                            color:#fff;
                            padding:5px 8px;
                            border-radius:5px;
                            cursor:pointer;
                            font-size:10px;
                            margin:2px;
                        "
                    >
                        🗑️ Remove
                    </button>

                </div>

            `;
        }
    );

    html += `</div>`;

    content.innerHTML =
        html;

    // Clear history
    const clearButton =
        document.getElementById(
            "movifindClearHistory"
        );

    if (clearButton) {

        clearButton.addEventListener(
            "click",
            clearMoviFindHistory
        );
    }

    // Open movie
    content
        .querySelectorAll(
            "[data-open-moviefind]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        const key =
                            this.dataset.openMoviefind;

                        const movie =
                            items.find(
                                item =>
                                    movifindMovieKey(item) ===
                                    key
                            );

                        if (!movie) {
                            return;
                        }

                        const input =
                            getElement(
                                "movieInput"
                            );

                        if (input) {

                            input.value =
                                movie.Title;
                        }

                        fetchMovie(
                            movie.Title
                        );

                        window.scrollTo({
                            top:0,
                            behavior:"smooth"
                        });

                    }
                );

            }
        );

    // Remove
    content
        .querySelectorAll(
            "[data-remove-moviefind]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        const key =
                            this.dataset.removeMoviefind;

                        const type =
                            this.dataset.removeSection;

                        if (
                            type ===
                            "favorites"
                        ) {

                            removeMoviFindFavorite(
                                key
                            );

                        }

                        if (
                            type ===
                            "watchlist"
                        ) {

                            removeMoviFindWatchlist(
                                key
                            );

                        }

                        if (
                            type ===
                            "history"
                        ) {

                            const history =
                                movifindGetStorage(
                                    MOVIFIND_STORAGE.history
                                );

                            movifindSetStorage(
                                MOVIFIND_STORAGE.history,
                                history.filter(
                                    movie =>
                                        movifindMovieKey(movie) !== key
                                )
                            );

                            updateMoviFindLibraryUI();
                        }

                    }
                );

            }
        );
}


// ======================================================
// 🔄 UPDATE LIBRARY
// ======================================================

function updateMoviFindLibraryUI() {

    const active =
        document.querySelector(
            ".movifind-library-tab.active"
        );

    const section =
        active?.dataset.libraryTab ||
        "favorites";

    renderMoviFindLibrary(
        section
    );
}


// ======================================================
// 🎨 LIBRARY TAB STYLE
// ======================================================

function setupMoviFindLibraryStyles() {

    if (
        document.getElementById(
            "movifindLibraryStyles"
        )
    ) {

        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "movifindLibraryStyles";

    style.textContent = `

        .movifind-library-tab {
            border:none;
            background:#24242d;
            color:#fff;
            padding:8px 13px;
            border-radius:6px;
            cursor:pointer;
            font-size:11px;
        }

        .movifind-library-tab:hover {
            background:#30303a;
        }

        .movifind-library-tab.active {
            background:#9c22c4;
        }

    `;

    document.head.appendChild(
        style
    );

    document
        .querySelectorAll(
            ".movifind-library-tab"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    function () {

                        document
                            .querySelectorAll(
                                ".movifind-library-tab"
                            )
                            .forEach(
                                item =>
                                    item.classList.remove(
                                        "active"
                                    )
                            );

                        this.classList.add(
                            "active"
                        );

                    }
                );

            }
        );
}


// ======================================================
// 🚀 START MOVIFIND LIBRARY
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setupMoviFindLibraryStyles();

        createMoviFindLibraryUI();

    }
);
// ======================================================
// 🎬 MOVIFIND NAVIGATION
// ======================================================

function setupMoviFindNavigation() {

    const navButtons =
        document.querySelectorAll(
            "[data-movifind-nav]"
        );

    if (!navButtons.length) {
        return;
    }

    navButtons.forEach(
        function (button) {

            button.addEventListener(
                "click",
                function () {

                    const section =
                        this.dataset.movifindNav;

                    // ------------------------------------------
                    // REMOVE ACTIVE FROM ALL
                    // ------------------------------------------

                    navButtons.forEach(
                        item => {

                            item.classList.remove(
                                "active"
                            );

                        }
                    );

                    // ------------------------------------------
                    // ADD ACTIVE
                    // ------------------------------------------

                    this.classList.add(
                        "active"
                    );

                    // ------------------------------------------
                    // HOME
                    // ------------------------------------------

                    if (
                        section ===
                        "home"
                    ) {

                        window.scrollTo({

                            top: 0,

                            behavior: "smooth"

                        });

                        return;
                    }

                    // ------------------------------------------
                    // LIBRARY
                    // ------------------------------------------

                    const library =
                        document.getElementById(
                            "movifindLibrary"
                        );

                    if (!library) {

                        console.warn(
                            "MoviFind Library is not available yet."
                        );

                        return;
                    }

                    // ------------------------------------------
                    // SCROLL TO LIBRARY
                    // ------------------------------------------

                    library.scrollIntoView({

                        behavior: "smooth",

                        block: "start"

                    });

                    // ------------------------------------------
                    // FIND LIBRARY TAB
                    // ------------------------------------------

                    const libraryTab =
                        document.querySelector(
                            `[data-library-tab="${section}"]`
                        );

                    if (libraryTab) {

                        setTimeout(
                            function () {

                                libraryTab.click();

                            },
                            250
                        );

                    }

                }
            );

        }
    );

    // ------------------------------------------
    // HOME ACTIVE BY DEFAULT
    // ------------------------------------------

    const homeButton =
        document.querySelector(
            '[data-movifind-nav="home"]'
        );

    if (homeButton) {

        homeButton.classList.add(
            "active"
        );

    }

}


// ======================================================
// 🚀 START NAVIGATION
// ======================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setupMoviFindNavigation();

    }
);