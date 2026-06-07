// ================================================================
//  DRAW TOGETHER — Configuration File
//  ================================================================
//
//  ⚠️  YOU MUST FILL IN YOUR OWN VALUES BELOW ⚠️
//
//  Follow the SETUP_GUIDE.md steps to get these values.
//  You will find them in your Firebase project settings.
//
//  ALSO: Change the admin username and password below.
//
// ================================================================


// ── STEP 1: Paste your Firebase config here ──────────────────────
//
//   Replace every "PASTE_YOUR_..." value with the real value
//   from your Firebase project.  Do NOT change the key names.
//
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBbVkORFwK9gHp3ZqP0KIH55d8j5Zhy2-Y",
  authDomain:        "draw-together-8a926.firebaseapp.com",
  databaseURL:       "https://draw-together-8a926-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId:         "draw-together-8a926",
  storageBucket:     "draw-together-8a926.firebasestorage.app",
  messagingSenderId: "969738697455",
  appId:             "1:969738697455:web:2327309e258caffb99791a"
};


// ── STEP 2: Set your Admin login details ─────────────────────────
//
//   Change these to whatever username and password you want.
//   The password is case-sensitive.
//
const ADMIN_CREDENTIALS = {
  username: "FairyTale",          // ← change this
  password: "ArLpgLar"     // ← change this to something secret!
};


// ── DO NOT EDIT BELOW THIS LINE ──────────────────────────────────
//
//   This line starts Firebase using the config above.
//
try {
  firebase.initializeApp(FIREBASE_CONFIG);
} catch (e) {
  console.error(
    "❌ Firebase failed to start. Did you fill in your config values in js/config.js?\n",
    e.message
  );
}
