// Minimal ZIP writer for exporting packs. Files are stored, not compressed: audio barely shrinks anyway.
// shortcut: no ZIP64, so a pack must stay under 4 GB and 65,535 files; add ZIP64 if packs ever get that big.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

export function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Names become safe file names; "/" keeps a folder ("808s/Boom.wav"); repeats get " (2)", " (3)"…
export function uniqueNames(names: string[]) {
  const seen = new Set<string>();
  return names.map((raw) => {
    // each part made safe; empty parts, ".." and hidden names disappear, so nothing lands outside the ZIP's folder
    const parts = raw.split("/").map((p) => p.replace(/[\\:*?"<>|]/g, "-").trim().replace(/^\.+/, "")).filter(Boolean);
    const clean = parts.join("/") || "file";
    const dot = clean.lastIndexOf(".");
    const [base, ext] = dot > clean.lastIndexOf("/") + 1 ? [clean.slice(0, dot), clean.slice(dot)] : [clean, ""];
    let name = clean;
    for (let i = 2; seen.has(name.toLowerCase()); i++) name = `${base} (${i})${ext}`;
    seen.add(name.toLowerCase());
    return name;
  });
}

export async function zip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const names = uniqueNames(files.map((f) => f.name));
  const parts: BlobPart[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const [i, file] of files.entries()) {
    const name = new TextEncoder().encode(names[i]);
    const crc = crc32(new Uint8Array(await file.blob.arrayBuffer()));
    const size = file.blob.size;
    // fields shared by the local header (from byte 4) and the central entry (from byte 6)
    const common = (v: DataView, at: number) => {
      v.setUint16(at, 20, true); // version needed
      v.setUint16(at + 2, 0x0800, true); // names are UTF-8
      v.setUint16(at + 4, 0, true); // stored
      v.setUint16(at + 6, time, true);
      v.setUint16(at + 8, date, true);
      v.setUint32(at + 10, crc, true);
      v.setUint32(at + 14, size, true);
      v.setUint32(at + 18, size, true);
      v.setUint16(at + 22, name.length, true);
    };
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    common(lv, 4);
    local.set(name, 30);

    const entry = new Uint8Array(46 + name.length);
    const cv = new DataView(entry.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true); // made by
    common(cv, 6);
    cv.setUint32(42, offset, true);
    entry.set(name, 46);

    parts.push(local, file.blob);
    central.push(entry);
    offset += local.length + size;
  }

  const centralSize = central.reduce((n, e) => n + e.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
}

// self-check (runs once in dev)
if (import.meta.env?.DEV) {
  console.assert(crc32(new TextEncoder().encode("hello")) === 0x3610a686, "crc32");
  console.assert(uniqueNames(["a.wav", "A.wav", "b/c.wav", "a.wav"]).join() === "a.wav,A (2).wav,b/c.wav,a (3).wav", "zip names", uniqueNames(["a.wav", "A.wav", "b/c.wav", "a.wav"]));
  console.assert(uniqueNames(["..", "../x.wav", "808s/.hidden", "kit/a.wav", "kit/a.wav"]).join() === "file,x.wav,808s/hidden,kit/a.wav,kit/a (2).wav", "zip names: folders, no dot-dot", uniqueNames(["..", "../x.wav", "808s/.hidden", "kit/a.wav", "kit/a.wav"]));
}
