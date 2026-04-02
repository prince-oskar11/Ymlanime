const API = "https://api.jikan.moe/v4";
const STREAM_API = "https://api.consumet.org/anime/gogoanime";

let currentEpisode = 1;
let currentAnimeId = null;
let currentEpisodesList = [];

// 🎬 HERO BANNER
async function loadHero() {
  const res = await fetch(API + "/top/anime");
  const data = (await res.json()).data[0];

  document.getElementById("hero").style.backgroundImage =
    `url(${data.images.jpg.large_image_url})`;

  document.getElementById("heroTitle").innerText = data.title;
}

// 🎞️ NETFLIX ROW
async function loadRow(title, endpoint) {
  const res = await fetch(API + endpoint);
  const data = (await res.json()).data;

  const row = document.createElement("div");
  row.innerHTML = `
    <h2>${title}</h2>
    <div class="row">
      ${data.map(a => card(a)).join("")}
    </div>
  `;
  document.getElementById("content").appendChild(row);
}

// 🎴 CARD UI
function card(a) {
  return `
  <div class="card" onclick="openAnime('${a.title}')">
    <img src="${a.images.jpg.image_url}">
    <div class="info">
      <span>${a.score || "?"}</span>
    </div>
  </div>`;
}

// 🎥 OPEN ANIME → LOAD EPISODES
async function openAnime(title) {
  const res = await fetch(`${STREAM_API}/${encodeURIComponent(title)}`);
  const data = await res.json();

  currentAnimeId = data.results[0].id;

  const epRes = await fetch(`${STREAM_API}/info/${currentAnimeId}`);
  const epData = await epRes.json();

  currentEpisodesList = epData.episodes;

  renderEpisodes(epData);
}

// 📺 EPISODES LIST
function renderEpisodes(data) {
  document.getElementById("content").innerHTML = `
    <h1>${data.title}</h1>
    <div class="episodes">
      ${data.episodes.map(ep => `
        <button onclick="playEpisode('${ep.id}', ${ep.number})">
          Episode ${ep.number}
        </button>
      `).join("")}
    </div>
  `;
}

// ▶️ PLAY EPISODE
async function playEpisode(id, number) {
  currentEpisode = number;

  const res = await fetch(`${STREAM_API}/watch/${id}`);
  const data = await res.json();

  const sources = data.sources;
  const subtitles = data.subtitles;

  document.getElementById("playerModal").classList.remove("hidden");

  const video = document.getElementById("videoPlayer");
  video.src = sources[0].url;

  // 🎧 SUB/DUB SELECTOR
  let subMenu = document.getElementById("subMenu");
  subMenu.innerHTML = subtitles.map(s =>
    `<option value="${s.url}">${s.lang}</option>`
  ).join("");
}

// 🔁 NEXT EPISODE
function nextEpisode() {
  let next = currentEpisodesList.find(e => e.number === currentEpisode + 1);
  if (next) playEpisode(next.id, next.number);
}

// 🏠 HOME
async function goHome() {
  document.getElementById("content").innerHTML = "";
  await loadHero();

  await loadRow("Trending", "/top/anime");
  await loadRow("Top Rated", "/top/anime?filter=bypopularity");
  await loadRow("Upcoming", "/seasons/upcoming");
}

// INIT
goHome();
