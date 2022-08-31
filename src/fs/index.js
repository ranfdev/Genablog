import { promiseTask } from "troll/src/util.js";
import Gio from "gi://Gio";

export const getFileModTime = (f) => {
  let t = f.get_modification_date_time() ?? f.get_creation_date_time();
  return t.format("%Y %B %d");
};
export async function* listFiles(folder, chunkSize = 4) {
  const nextFiles = (en) =>
    promiseTask(
      en,
      "next_files_async",
      "next_files_finish",
      chunkSize,
      0,
      null
    );
  let en = await promiseTask(
    folder,
    "enumerate_children_async",
    "enumerate_children_finish",
    Gio.FILE_ATTRIBUTE_STANDARD_NAME +
      "," +
      Gio.FILE_ATTRIBUTE_TIME_CREATED +
      "," +
      "," +
      Gio.FILE_ATTRIBUTE_TIME_MODIFIED,
    Gio.FileQueryInfoFlags.NOFOLLOW_SYMLINKS,
    null,
    null
  );
  let files;
  while ((files = await nextFiles(en)).length > 0) {
    for (let f of files) {
      yield f;
    }
  }
}

export function getExt(path) {
  const nextSlash = path.lastIndexOf("/");
  const extIndex = path.lastIndexOf(".");
  const basename = path.slice(nextSlash + 1);
  return basename.split(extIndex);
}

// Example: 
// makeDirStructure(rootFile, {
//   content: "content",
//   blog: "content/blog",
// })
export function makeDirStructure(root, dirs) {
  const res = {};
  for (let [k, v] of Object.entries(dirs)) {
    if (v.startsWith("/")) {
      v = v.substring(1)
    }
    const c = root.get_child(v);
    try {
      c.make_directory_with_parents(null);
    } catch (e) {
      if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
        throw e;
      }
    }
    res[k] = c;
  }
  return res;
}
