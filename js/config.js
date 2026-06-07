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
  apiKey:            "AIzaSyBFc597khPRThMIGF4BRkqA7VxnNEM0zFk",
  authDomain:        "shared-drawing-canvas.firebaseapp.com",
  databaseURL:       "https://shared-drawing-canvas-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "shared-drawing-canvas",
  storageBucket:     "shared-drawing-canvas.firebasestorage.app",
  messagingSenderId: "379615731075",
  appId:             "1:379615731075:web:113fea60f358360975aab6"
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
