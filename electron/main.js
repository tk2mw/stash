// Desktop shell: a window around the built web app (dist/), with no server.
// Pages are served from app://stash so IndexedDB, localStorage and the folder picker get a stable, secure origin.
import { app, BrowserWindow, dialog, ipcMain, Menu, net, protocol, session, shell } from "electron";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const dist = path.join(import.meta.dirname, "..", "dist");
// only our own files run; inline styles are motion's, blob: is audio, covers and the picture from IndexedDB
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self' blob: data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";

// RAR files can only be made by WinRAR itself: packs export as RAR with the user's own copy, when it's installed
const rarExe = ["ProgramFiles", "ProgramFiles(x86)"].map((v) => process.env[v] && path.join(process.env[v], "WinRAR", "Rar.exe")).find((p) => p && existsSync(p));

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

// one window: a second launch brings the first one forward instead of opening the library twice
if (!app.requestSingleInstanceLock()) app.quit();

app.whenReady().then(() => {
  protocol.handle("app", async (req) => {
    const file = path.join(dist, decodeURIComponent(new URL(req.url).pathname));
    if (path.relative(dist, file).startsWith("..")) return new Response("Not found", { status: 404 });
    const res = await net.fetch(pathToFileURL(file).toString(), { headers: req.headers });
    const headers = new Headers(res.headers);
    headers.set("Content-Security-Policy", CSP);
    return new Response(res.body, { status: res.status, headers });
  });
  // the folder picker is the only permission stash needs; camera, microphone, location and the rest are refused
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === "fileSystem" || permission === "clipboard-sanitized-write"));

  // no Windows title bar: the app header is the drag area and has its own window buttons (src/app/WindowControls.tsx)
  Menu.setApplicationMenu(null);
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    title: "stash",
    backgroundColor: "#090909",
    titleBarStyle: "hidden",
    webPreferences: { preload: path.join(import.meta.dirname, "preload.cjs") },
  });
  const sendMaximized = () => win.webContents.send("maximized", win.isMaximized());
  win.on("maximize", sendMaximized);
  win.on("unmaximize", sendMaximized);
  ipcMain.on("window", (e, action) => {
    if (e.sender !== win.webContents) return;
    if (action === "minimize") win.minimize();
    else if (action === "toggleMaximize") win.isMaximized() ? win.unmaximize() : win.maximize();
    else if (action === "close") win.close();
    else if (action === "state") sendMaximized();
  });

  ipcMain.handle("rar:has", (e) => e.sender === win.webContents && !!rarExe);
  // `entries` ("808s/Boom.wav" + bytes) go into a temp folder, WinRAR packs that folder, the temp folder goes away
  ipcMain.handle("rar:save", async (e, name, entries) => {
    if (e.sender !== win.webContents || !rarExe) return false;
    const { canceled, filePath } = await dialog.showSaveDialog(win, { defaultPath: `${name}.rar`, filters: [{ name: "RAR archive", extensions: ["rar"] }] });
    if (canceled || !filePath) return false;
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "stash-rar-"));
    try {
      for (const { path: rel, data } of entries) {
        const file = path.join(tmp, rel);
        const inside = path.relative(tmp, file);
        // the names come from the page: nothing may land outside the temp folder
        if (!inside || inside.startsWith("..") || path.isAbsolute(inside)) throw new Error(`Bad file name: ${rel}`);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, Buffer.from(data));
      }
      await fs.rm(filePath, { force: true }); // "a" would add to an old archive of the same name
      await new Promise((resolve, reject) => execFile(rarExe, ["a", "-r", "-y", "-idq", "-ep1", filePath, path.join(tmp, "*")], { windowsHide: true }, (err) => (err ? reject(err) : resolve())));
      return true;
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
  // web links open in the browser, never inside stash; other schemes (file:, ms-…) are never opened
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("app://stash/")) e.preventDefault();
  });
  win.loadURL("app://stash/index.html");

  app.on("second-instance", () => {
    if (win.isMinimized()) win.restore();
    win.focus();
  });
});

app.on("window-all-closed", () => app.quit());
