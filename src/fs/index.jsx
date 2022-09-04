import { promiseTask } from "troll/src/util.js";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import {
  children,
  createContext,
  createEffect,
  createRoot,
  onCleanup,
  useContext,
} from "solid-js";

const encoder = new TextEncoder();

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
      v = v.substring(1);
    }
    const dir = root.get_child(v);
    try {
      dir.make_directory_with_parents(null);
    } catch (e) {
      if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
        throw e;
      }
    }
    res[k] = dir;
  }
  return res;
}
async function replace(file, content) {
  await promiseTask(
    file,
    "replace_contents_async",
    "replace_contents_finish",
    encoder.encode(content),
    null,
    false,
    Gio.FileCreateFlags.REPLACE_DESTINATION,
    null
  );
}

const DirContext = createContext(null);

export function renderFs(tree, dir) {
  return createRoot(() => {
    <DirContext.Provider value={dir}>{tree()}</DirContext.Provider>;
  });
}

export function Dir(props) {
  const path = props.path;
  const parent = useContext(DirContext);
  const dir = parent.get_child(path);
  try {
    dir.make_directory_with_parents(null);
  } catch (e) {
    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
      throw e;
    }
  }
  onCleanup(() => {
    promiseTask(
      dir,
      "delete_async",
      "delete_finish",
      GLib.PRIORITY_DEFAULT,
      null
    ).catch(console.log);
  })
  return <DirContext.Provider value={dir}>{props.children}</DirContext.Provider>;
}



export function File(props) {
  const path = props.path;
  const parent = useContext(DirContext);

  if (!path) {
    throw Error("Path must be defined and not empty");
  }
  const file = parent.get_child(path);
  replace(file, props.children ?? "").catch(e => {console.log(e)});

  onCleanup(() => {
    promiseTask(
      file,
      "delete_async",
      "delete_finish",
      GLib.PRIORITY_DEFAULT,
      null
    ).catch(console.log);
  })

  return <></>;
}
