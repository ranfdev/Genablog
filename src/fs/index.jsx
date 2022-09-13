import { promiseTask } from "troll/src/util.js";
import Gio from "gi://Gio";
import GLib from "gi://GLib";
import {
  children,
  createContext,
  createEffect,
  createResource,
  createRoot,
  ErrorBoundary,
  onCleanup,
  useContext,
} from "solid-js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

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
    content,
    null,
    false,
    Gio.FileCreateFlags.REPLACE_DESTINATION,
    null
  );
}

const FSContext = createContext(null);

export function renderFs(tree, dir) {
  return createRoot(() => {
    <FSContext.Provider value={GioFS(dir)}>{tree()}</FSContext.Provider>;
  });
}

export function Dir(props) {
  const path = props.path;
  const fs = useContext(FSContext);
  const [newFs] = createResource(async () => await fs.createDir(props.path));

  onCleanup(() => fs.remove(path).catch(console.log));
  return (
    <Show when={!newFs.loading && !newFs.error}>
      <FSContext.Provider value={newFs()}>{props.children}</FSContext.Provider>
    </Show>
  );
}

export function File(props) {
  const path = props.path;
  const fs = useContext(FSContext);
  console.log(fs.getPath());

  if (!path) {
    throw Error("Path must be defined and not empty");
  }
  fs.replaceFile(path, props.children).catch((e) => {
    console.log(e);
  });

  onCleanup(() => {
    fs.remove(path).catch(console.log);
  });

  return <></>;
}

function GioFS(rootDir) {
  return {
    getPath() {
      return rootDir.get_path();
    },
    async createDir(basename) {
      const dir = rootDir.get_child(basename);
      try {
        await promiseTask(
          dir,
          "make_directory_async",
          "make_directory_finish",
          GLib.PRIORITY_DEFAULT,
          null
        );
      } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS)) {
          throw e;
        }
      }
      return GioFS(dir);
    },
    async replaceFile(basename, content) {
      const file = rootDir.get_child(basename);
      console.log(file.get_path());
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
    },
    async remove(path) {
      const child = rootDir.get_child(path);
      return await promiseTask(
        child,
        "delete_async",
        "delete_finish",
        GLib.PRIORITY_DEFAULT,
        null
      );
    },
  };
}
export function Overlay(props) {
  const fs = useContext(FSContext);
  const overTracker = new Set();
  const underTracker = {};
  const overFs = {
    getPath() {
      return fs.getPath();
    },
    async replaceFile(basename, content) {
      overTracker.add(basename);
      return await fs.replaceFile(basename, content);
    },
    async removeFile(basename) {
      overTracker.delete(basename);
      if (underTracker[basename]) {
        return await fs.replaceFile(basename, underTracker[basename]);
      }
      return await fs.removeFile(basename);
    },
    async createDir(basename) {
      overTracker.add(basename);
      return await fs.createDir(basename);
    },
  };
  const underFs = {
    getPath() {
      return fs.getPath();
    },
    async replaceFile(basename, content) {
      underTracker[basename] = content;
      if (overTracker.has(basename)) {
        // Return without writing to the underlying fs,
        // to not overwrite the overlay file
        return;
      }
      return await fs.replaceFile(basename, content);
    },
    async removeFile(basename) {
      underTracker.delete(basename);
      if (overFs.has(basename)) {
        // Return without writing to the underlying fs,
        // to not overwrite the overlay file
        return;
      }
      return await fs.removeFile(basename);
    },
    async createDir(basename) {
      underTracker[basename] = true;
      return await fs.createDir(basename);
    },
  };
  return (
    <>
      <FSContext.Provider value={overFs}>{props.over}</FSContext.Provider>
      <FSContext.Provider value={underFs}>{props.children}</FSContext.Provider>
    </>
  );
}

export function RemoteDir(props) {
  const [files] = createResource(async () => {
    const ls = listFiles(props.dir);
    const res = [];
    for await (const finfo of ls) {
      const file = props.dir.get_child(finfo.get_name());
      const [_ok, contents] = file.load_contents(null);
      res.push([file, decoder.decode(contents)]);
    }
    return res;
  });

  return (
    <ErrorBoundary fallback={(e) => console.log(e)}>
      <Show when={!files.loading && !files.error}>
        <For each={files()}>
          {([file, contents]) => (
            <File path={file.get_basename()}>{contents}</File>
          )}
        </For>
      </Show>
      <Show when={files.error}>{console.log(files.error)}</Show>
    </ErrorBoundary>
  );
}
