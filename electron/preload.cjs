// The page's only bridge to the desktop: the window buttons, and RAR export through the user's WinRAR. Nothing else.
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("stashWindow", {
  minimize: () => ipcRenderer.send("window", "minimize"),
  toggleMaximize: () => ipcRenderer.send("window", "toggleMaximize"),
  close: () => ipcRenderer.send("window", "close"),
  hasRar: () => ipcRenderer.invoke("rar:has"),
  saveRar: (name, entries) => ipcRenderer.invoke("rar:save", name, entries),
  onMaximized: (fn) => {
    const listener = (_e, maximized) => fn(maximized);
    ipcRenderer.on("maximized", listener);
    ipcRenderer.send("window", "state");
    return () => ipcRenderer.removeListener("maximized", listener);
  },
});
