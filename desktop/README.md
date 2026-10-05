# CILI Scheduler — Desktop Application

A desktop build of the CILI Scheduler. Same application as the web version, but the
record lives in a real file on the hard drive instead of browser storage — no size
limit, no risk of losing it by clearing site data, and somewhere you can see and copy.

---

## What you need

**Node.js 22.12 or newer** (the current LTS installer is fine). Electron's own installer
will not run on anything older. Download the LTS installer from nodejs.org and accept the defaults.
Check it worked by opening a terminal (Command Prompt or PowerShell on Windows) and
running:

```
node --version
```

Nothing else. Electron and the packaging tool install themselves in the next step.

---

## Building it

From this folder, in a terminal:

```
npm install
```

That pulls down Electron and the builder — a few hundred megabytes, one time only.

**To run it without installing anything:**

```
npm start
```

The app opens. Good for checking it works before you package it.

**To build a Windows installer:**

```
npm run build:win
```

Two files appear in `dist/`:

- `CILI Scheduler Setup 1.2.0.exe` — a normal installer. Creates a Start Menu entry
  and a desktop shortcut.
- `CILI Scheduler 1.2.0.exe` — portable. No installation; runs from wherever you put
  it, including a USB stick.

For Mac use `npm run build:mac`, for Linux `npm run build:linux`. Each has to be built
on its own platform — you cannot produce a Mac build from Windows.

---

## Where the data lives

```
Documents\CILI Scheduler\cili-scheduler-data.json
```

Deliberately in Documents rather than a hidden application folder. The whole point of
moving off browser storage was that the record should be somewhere you can find, copy,
and put on the office server.

**File → Open Data Folder** takes you straight there.
**File → Change Data Folder** points the app somewhere else — a network drive, for
instance. It asks what you want in the new place:

- **Copy my schedule there** — the app copies the data file across and carries on with
  the copy. The original stays where it was, untouched.
- **Start a new schedule there** — the new folder starts fresh; the old one keeps its file.
- If the folder you pick already holds a data file, the app offers to open that one
  instead, and never writes over it.

A folder the app cannot write to is refused, with the reason, and nothing changes.

### Rolling backups

```
Documents\CILI Scheduler\backups\
```

Two kinds, kept automatically — nobody has to remember:

- **`daily-YYYY-MM-DD.json`** — the file as it stood at the *start* of that day, taken
  by the first save of the day. The last 30 days are kept. This is the one for *"it
  was fine yesterday"*.
- **`recent-….json`** — at most one every ten minutes, the last twelve kept. This is
  the one for *"undo what I just did"*.

The daily copies are there because the first version kept only the twenty most recent
saves, and an ordinary hour of editing is twenty saves — so a mistake noticed the next
morning had no copy left from before it.

A third kind, **`replaced-….json`**, is only made when you tell the app to write over a
version of the file it did not make (see *Two computers, one file* below). The last
twenty are kept.

To recover, close the app, copy the backup you want over `cili-scheduler-data.json`,
and reopen.

Only files with exactly these names are ever cleaned up. Anything else in the folder —
a copy you made and renamed, `daily-2026-09-03 - Copy.json`, the `data-….json` files
from an earlier version — is yours and is never deleted.

This is separate from **Backup → Download Backup File** inside the app, which is still
how you move data between machines or hand it to someone.

### The data file is a backup file

The saved file uses exactly the same format as the app's backup export. They are
interchangeable — a backup can be copied straight over the data file, and the data
file can be imported through the Backup window. One format, no conversion.

---

## How it protects the record

**Atomic writes.** Saves go to a temporary file, are forced onto the disk, and are then
renamed into place. A crash or power cut mid-write leaves the previous file intact
rather than half a file.

**No writing after a failed read.** If the data file is damaged, empty, holds something
else, or sits on a drive that is not connected, the app does *not* fall back to sample
data and does *not* save. It says so in a banner and switches saving off, because from
the inside "nothing here yet" and "cannot see it" look the same — and guessing wrong
would write a fresh schedule over the real record. Only a file that has never existed
counts as a first run. To carry on from a backup, use **Backup → Replace**; the file
that could not be read is kept as a `replaced-…` copy first.

**A save that fails stays on screen.** If the file cannot be written — the drive has
gone, the folder is read-only — a red banner says so and stays until the write goes
through. The app keeps trying on its own. Closing the window while changes are still
unsaved asks what to do with them: try again, save a copy somewhere else, or close
without saving.

**Nothing is lost on the way out.** Closing the window waits for the last write to
finish. A project form with unsaved changes asks before the app closes.

**One window only.** A second launch focuses the existing window rather than opening a
second copy that would fight over the same file.

**Locked files are retried.** If something else has the data file open for a moment —
OneDrive syncing Documents, an antivirus scan — the save waits briefly and tries again
before reporting a failure. Reading the file at start-up does the same.

### Two computers, one file

The app allows one window per computer, but it cannot stop a second computer opening
the same file on a shared drive. What it does do: before every save it checks that the
file is still the one it last read. If something else has changed it — another
computer, or a copy dropped in its place — the save stops, nothing is overwritten, and
a banner asks which version to keep:

- **Load the file's version** — takes what is on disk; what this window had is dropped.
- **Keep what is here** — writes this window's version, after keeping the other one as
  a `replaced-…` copy in the backups folder.

This makes sharing a folder safe from silent loss. It does not merge two people's
work: for several people editing at once, the server version is still the answer.

**No silent fallback.** If the app ever starts without its connection to the data
file, it stops saving and says so in a banner, rather than quietly keeping your work
somewhere you would never find it.

---

## Moving to the server later

The application detects where it is running and picks its storage accordingly:

| Where it runs | Where data goes |
|---|---|
| Desktop app | `cili-scheduler-data.json` via the preload bridge |
| Web page | Browser storage |
| Server (later) | An HTTP adapter, slotted in the same place |

Everything above the storage layer — every view, every calculation — is identical in
all three. Adding the server means writing one adapter and the edit-lock handling
discussed separately; it does not mean rebuilding the application.

---

## Files

```
package.json    Dependencies and build configuration
main.js         Window and menus
store.js        Reading, writing and rolling backups of the data file
preload.js      The only bridge between the app and the machine
app/index.html  The scheduler itself — one self-contained file
```

`preload.js` is deliberately narrow. The application cannot reach Node or the
filesystem. It can load the data file, save it, ask where it is, and write a backup to
a location you chose in a dialog. Nothing else.

**The network.** The only thing the app asks the internet for is its typeface (IBM
Plex, from Google Fonts). Without a connection it starts just the same and uses the
system typeface. Every other outgoing request is refused by the app itself, so nothing
in an imported file has anywhere to send data. Links to other websites open in your
normal browser, never inside the app.
