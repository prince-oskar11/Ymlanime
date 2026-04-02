// ---------------------------
// 1️⃣ FIREBASE INIT
// ---------------------------
const firebaseConfig = {
  apiKey: "YOUR_KEY",
  authDomain: "YOUR_DOMAIN",
  projectId: "YOUR_ID"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
let currentUser = null;
let currentProfile = null;

// ---------------------------
// 2️⃣ AUTH STATE
// ---------------------------
auth.onAuthStateChanged(user => {
  if (user) {
    currentUser = user;
    currentProfile = localStorage.getItem("activeProfile");
    if (!currentProfile) showProfiles();
    else goHome();
  } else showAuth();
});

// ---------------------------
// 3️⃣ AUTH UI
// ---------------------------
function showAuth(){
  document.getElementById("content").innerHTML = `
    <h2>Login / Sign Up</h2>
    <input id="email" placeholder="Email">
    <input id="password" type="password" placeholder="Password">
    <button onclick="signup()">Sign Up</button>
    <button onclick="login()">Login</button>
    <button onclick="googleLogin()">Google Sign-In</button>
  `;
}

function signup(){
  let email = document.getElementById("email").value;
  let pass = document.getElementById("password").value;
  auth.createUserWithEmailAndPassword(email,pass)
      .then(()=>alert("Account created"))
      .catch(e=>alert(e.message));
}

function login(){
  let email = document.getElementById("email").value;
  let pass = document.getElementById("password").value;
  auth.signInWithEmailAndPassword(email,pass)
      .catch(e=>alert(e.message));
}

function googleLogin(){
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(e=>alert(e.message));
}

function logout(){
  auth.signOut();
  localStorage.removeItem("activeProfile");
}

// ---------------------------
// 4️⃣ PROFILES
// ---------------------------
async function showProfiles(){
  const snap = await db.collection("users")
    .doc(currentUser.uid)
    .collection("profiles")
    .get();
  document.getElementById("content").innerHTML = `
    <h1>Select Profile</h1>
    ${snap.docs.map(d=>`<div class="profile" onclick="selectProfile('${d.id}')">${d.id}</div>`).join("")}
    <input id="newProfile" placeholder="New Profile">
    <button onclick="createProfile(document.getElementById('newProfile').value)">Add</button>
  `;
}

async function createProfile(name){
  if(!name) return;
  await db.collection("users").doc(currentUser.uid)
    .collection("profiles").doc(name)
    .set({name, created:Date.now()});
  selectProfile(name);
}

function selectProfile(name){
  currentProfile = name;
  localStorage.setItem("activeProfile",name);
  goHome();
}

// ---------------------------
// 5️⃣ TV REMOTE NAVIGATION
// ---------------------------
let focusIndex = 0, items=[];
function updateFocusable(){ items = [...document.querySelectorAll(".card,button")]; }
function navigate(dir){
  updateFocusable();
  if(dir==="right") focusIndex++;
  if(dir==="left") focusIndex--;
  if(dir==="down") focusIndex+=5;
  if(dir==="up") focusIndex-=5;
  focusIndex = Math.max(0, Math.min(items.length-1, focusIndex));
  items.forEach(i=>i.classList.remove("focused"));
  if(items[focusIndex]) items[focusIndex].classList.add("focused");
}
function selectItem(){ if(items[focusIndex]) items[focusIndex].click(); }

// ---------------------------
// 6️⃣ API SETTINGS
// ---------------------------
const API = "https://api.jikan.moe/v4";
const STREAM = "https://api.consumet.org/anime/gogoanime";
let currentAnimeId = null;
let currentEpisode = null;

// ---------------------------
// 7️⃣ HOME / HERO / ROWS
// ---------------------------
async function goHome(){
  if(!currentProfile){ showProfiles(); return; }
  document.getElementById("content").innerHTML="";
  await loadHero();
  await loadContinueWatching();
  await loadRow("🔥 Trending","/top/anime");
  await loadRow("⭐ Most Popular","/top/anime?filter=bypopularity");
  await loadRow("📺 Playing Now","/seasons/now");
  await loadRow("⏳ Upcoming","/seasons/upcoming");
  await loadSmartRecommendations();
}

async function loadHero(){
  const res = await fetch(API+"/top/anime");
  const data = (await res.json()).data;
  const hero = data[0];
  document.getElementById("hero").style.backgroundImage=`url(${hero.images.jpg.image_url})`;
  document.getElementById("heroTitle").innerText=hero.title;
}

function renderRow(title, list){
  const html = `<h2>${title}</h2><div class="row">${list.map(a=>`<div class="card" onclick="openAnime('${a.title}')"><img src="${a.images.jpg.image_url}"></div>`).join("")}</div>`;
  document.getElementById("content").insertAdjacentHTML("beforeend", html);
}

async function loadRow(title, endpoint){
  const res = await fetch(API+endpoint);
  const data = (await res.json()).data;
  renderRow(title,data);
}

// ---------------------------
// 8️⃣ ANIME DETAIL & PLAYER
// ---------------------------
async function openAnime(title){
  const res = await fetch(`${STREAM}/${title}`);
  const data = await res.json();
  currentAnimeId = data.results[0].id;
  const info = await fetch(`${STREAM}/info/${currentAnimeId}`);
  const epData = await info.json();
  currentEpisode = epData.episodes[0].number;
  document.getElementById("content").innerHTML = epData.episodes.map(e=>`<button onclick="playEpisode('${e.id}',${e.number})">Ep ${e.number}</button>`).join("");
}

async function playEpisode(id,num){
  currentEpisode=num;
  const res = await fetch(`${STREAM}/watch/${id}`);
  const data = await res.json();
  const video = document.getElementById("videoPlayer");
  video.src=data.sources[0].url;
  document.getElementById("playerModal").classList.remove("hidden");

  // SUBS
  document.getElementById("subMenu").innerHTML = data.subtitles.map(s=>`<option>${s.lang}</option>`).join("");

  // SKIP INTRO
  video.ontimeupdate = ()=>{ if(video.currentTime>5 && video.currentTime<60) document.getElementById("skipIntro").style.display="block"; };
  document.getElementById("skipIntro").onclick = ()=>{ video.currentTime=60; };

  // NEXT EP
  video.onended = ()=>nextEpisode();

  // SAVE PROGRESS
  video.ontimeupdate = ()=>saveProgress(currentAnimeId,currentEpisode,video.currentTime);
  let prog = await loadProgress(currentAnimeId);
  if(prog) video.currentTime=prog.time;
}

function nextEpisode(){ alert("Next episode coming up..."); }

// ---------------------------
// 9️⃣ CLOUD FUNCTIONS
// ---------------------------
async function saveProgress(animeId,episode,time){
  if(!currentUser||!currentProfile) return;
  await db.collection("users").doc(currentUser.uid)
    .collection("profiles").doc(currentProfile)
    .collection("progress").doc(animeId)
    .set({episode,time,updated:Date.now()});
}

async function loadProgress(animeId){
  if(!currentUser||!currentProfile) return null;
  const doc = await db.collection("users").doc(currentUser.uid)
    .collection("profiles").doc(currentProfile)
    .collection("progress").doc(animeId).get();
  return doc.exists ? doc.data() : null;
}

// WISHLIST
async function addWishlist(animeId){
  if(!currentUser||!currentProfile) return;
  await db.collection("users").doc(currentUser.uid)
    .collection("profiles").doc(currentProfile)
    .collection("wishlist").doc(animeId).set({added:true});
}

// LOAD SMART RECOMMENDATIONS
async function loadSmartRecommendations(){
  if(!currentUser||!currentProfile) return;
  const snap = await db.collection("users").doc(currentUser.uid)
    .collection("profiles").doc(currentProfile).collection("progress").get();
  let genres=[];
  for(let doc of snap.docs){
    const res = await fetch(`${API}/anime/${doc.id}`);
    const anime = (await res.json()).data;
    genres.push(...anime.genres.map(g=>g.name));
  }
  let favGenre = genres.sort((a,b)=>genres.filter(v=>v===a).length - genres.filter(v=>v===b).length).pop();
  const res = await fetch(`${API}/anime?genres=${favGenre}`);
  const data = (await res.json()).data;
  renderRow(`🤖 Because you watch ${favGenre}`,data);
}

// ---------------------------
// 10️⃣ SEARCH
// ---------------------------
document.getElementById("search").addEventListener("input",async e=>{
  let q=e.target.value;
  if(!q) return;
  const res = await fetch(`${API}/anime?q=${q}`);
  const data = (await res.json()).data;
  renderRow(`Search: ${q}`,data);
});
