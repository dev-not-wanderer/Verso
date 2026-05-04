# Verso 
(Skip to line 50 for setup instructions)
A feature-rich notes app with tasks, goals, calendars, folders, encryption, and deep customization. Built with React + Capacitor for Android.
## Features 

**Notes**
- Rich text editor — bold, italic, highlight, text color, font size, alignment, tables
- Pin, label, and prioritize notes
- Background images per note
- Word goal tracker with progress ring
- Quick Capture for instant thoughts
- Note templates (blank, task, goal, timeline, journal, and more)

**Organization**
- Folders with note counts
- Bulk select — delete, duplicate, pin
- Sort by date, title, priority
- Filter by tasks, goals, encrypted, label
- Full-text search

**Tasks & Goals**
- Tasks with due dates, status (pending / in progress / done), and subtasks
- Goals with a percentage progress bar
- Timeline notes with dated entries
- Recurring notes

**Calendar**
- Monthly calendar view
- Events with start/end times, colors, and priority
- All-day events and recurring events
- Link events to notes
- Multiple calendars (personal, work, etc.)

**Timeline**
- Visual history of all dated notes and tasks grouped by overdue, today, upcoming, and later

**Security**
- Per-note encryption with password lock
- App-wide PIN lock with auto-lock on background

**Customization**
- Themes: Dark, Light, AMOLED, Sepia, Midnight, Forest
- Custom fonts
- Editor font size, line height, card radius, density

**Export & Share**
- Export notes as `.txt`, `.md`, or `.html`
- Native Android share sheet via Capacitor

Setup
Requirements

Node.js LTS
JDK 17 (JAVA_HOME set)
Android Studio with Android SDK API 34+
ANDROID_HOME set and platform-tools in Path

Install
bashnpm install
Run in browser
bashnpm run dev
Build for Android
bashnpm run build
npx cap add android
npx cap sync android
npx cap open android
Then hit Run in Android Studio.
After any code change
bashnpm run build && npx cap sync android

Android config
After npx cap add android, make these changes before building:

android/variables.gradle → minSdkVersion = 23
android/app/src/main/AndroidManifest.xml → add permissions (see below)
android/app/src/main/res/values/styles.xml → dark launch background
android/app/src/main/res/values/colors.xml → #0c0d10
android/app/src/main/res/xml/file_paths.xml → create for FileProvider

See full manifest permissions:
xml<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.CAMERA" />

Project structure
verso/
├── src/
│   ├── main.jsx        # Entry point + storage adapter + runtime permissions
│   └── Verso.jsx       # Main app
├── assets/
│   ├── verso-icon-violet.svg
│   └── verso-icon-red.svg
├── index.html
├── vite.config.js
└── package.json

Tech

React 19
Vite 8
Capacitor 8
@capacitor/preferences — persistent storage
@capacitor/local-notifications — reminders
@capacitor/camera — image picker
@capacitor/share + @capacitor/filesystem — export/share notes
lucide-react — icons


License
MIT
