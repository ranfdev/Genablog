import * as nunjucks from "nunjucks/browser/nunjucks";
import GLib from "gi://GLib";
import buffer from "buffer";
import { marked } from "marked";
import matter from "gray-matter";
import toml from "toml"
import {
  getFileModTime,
  listFiles,
  makeDirStructure,
  Dir,
  File,
  renderFs,
  Root,
} from "../fs/index.jsx";
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Show,
} from "solid-js";
import Gio from "gi://Gio";

import { promiseTask } from "troll/src/util.js";
import { createStore, produce } from "solid-js/store";
import { Key } from "@solid-primitives/keyed";

const STATE = {
  RENDERING: "rendering",
  READY: "ready",
  INITIALIZING: "initializing",
};

var decoder = new TextDecoder();

globalThis.Buffer = buffer.Buffer;

function initSiteDir(siteDir) {
  makeDirStructure(siteDir, {
    blog: "content/blog",
    themes: "themes",
    static: "static",
  });
  const requiredFiles = ["config.toml"];
  for (let fi of requiredFiles) {
    let f = siteDir.get_child(fi);
    if (!f.query_exists(null)) {
      GLib.file_set_contents(f.get_path(), "");
    }
  }
}

async function isDirEmpty(siteDir) {
  return !!(await listFiles(siteDir).next());
}

function createTemplateEnv(themeDir) {
  let Loader = nunjucks.Loader.extend({
    getSource: function (name) {
      const path = themeDir.get_path() + "/" + name;
      const [_ok, contents] = GLib.file_get_contents(path);
      return {
        src: decoder.decode(contents),
        path,
        noCache: false,
      };
    },
  });

  const env = new nunjucks.Environment(new Loader(), {
    autoescape: false,
  });
  return env;
}

function isTempFile(f) {
  const lastDot = f.get_path().lastIndexOf(".");
  const ext = f.get_path().slice(lastDot + 1);
  return ext.length == 6 && ext.toUpperCase() == ext;
}

function readPageFull(f, fi) {
  const [_ok, contents] = f.load_contents(null);
  const m = matter(decoder.decode(contents), {
    engines: {
      toml: toml.parse.bind(toml)
    },
    language: "toml",
    delimiters: ["+++", "+++"],
  });
  const page = {
    ...m.data,
    template: m.data.template ?? "index.html",
    path: f.get_path(),
    content: marked(m.content),
    modified: fi.get_modification_date_time().format_iso8601(),
  };
  return page;
}
function readPage(f) {
  const fi = f.query_info(
    Gio.FILE_ATTRIBUTE_TIME_MODIFIED,
    Gio.FileQueryInfoFlags.NONE,
    null
  );
  return readPageFull(f, fi);
}
async function fetchPages(dir) {
  const pages = {};
  const en = listFiles(dir);
  for await (let fi of en) {
    const f = dir.get_child(fi.get_name());
    pages[f.get_path()] = readPageFull(f, fi);
  }
  return pages;
}
function monitorPages(dir, mutate) {
  const monitor = dir.monitor_directory(Gio.FileMonitorFlags.WATCH_MOVES, null);
  monitor.set_rate_limit(0);

  // Polling the monitor keeps it working. Without this, the monitor stops
  // notifying changes without any reason...
  setInterval(() => monitor.is_cancelled(), 500);

  monitor.connect("changed", (monitor, file, other_file, ev_type) => {
    print("CHANGED", ev_type);
    if (ev_type == Gio.FileMonitorEvent.RENAMED) {
      // other_file is the destination file
      if (!isTempFile(other_file)) {
        try {
          mutate(
            produce((pages) => {
              pages[other_file.get_path()] = readPage(other_file);
            })
          );
        } catch (e) {
          console.warn("Error reading changed file: ", e, e.message);
        }
      }
      if (!isTempFile(file)) {
        mutate(
          produce((pages) => {
            delete pages[file.get_path()];
          })
        );
      }
    }
    if (
      [
        Gio.FileMonitorEvent.CREATED,
        Gio.FileMonitorEvent.MOVED_IN,
        Gio.FileMonitorEvent.CHANGED,
      ].includes(ev_type)
    ) {
      if (!isTempFile(file)) {
        try {
          mutate(
            produce((pages) => {
              pages[file.get_path()] = readPage(file);
            })
          );
        } catch (e) {
          console.warn("Error reading changed file: ", e, e.message);
        }
      }
    }
    if (
      [Gio.FileMonitorEvent.DELETED, Gio.FileMonitorEvent.MOVED_OUT].includes(
        ev_type
      )
    ) {
      if (!isTempFile(file)) {
        mutate(
          produce((pages) => {
            delete pages[file.get_path()];
          })
        );
      }
    }
  });
}
function usePages(dir) {
  const bdir = dir.get_child("content/blog");
  const [pages, { mutate }] = createResource(
    async () => await fetchPages(bdir)
  );
  monitorPages(bdir, mutate);
  return pages;
}

function deriveTaxonomies(pages, taxonomies) {
  // Maps a taxonomy to each possible terms.
  // Maps each term to pages containing that term.
  // Example:
  // {
  //     "tags": {
  //         "programming": [page1, page2],
  //         "lifestyle": [page3, page2],
  //     }
  // }
  const taxmap = {};

  for (let taxonomy of taxonomies) {
    taxmap[taxonomy] = {};
  }

  for (let p of pages) {
    for (let taxonomy of p.taxonomies) {
      for (let term of taxonomy) {
        if (!taxmap[taxonomy][term]) {
          taxmap[taxonomy][term] = [];
        }
        taxmap[taxonomy][term].push(page);
      }
    }
  }

  return taxmap;
}

export function renderSite(ssgState) {
  let fsTree = () => (
    <>
      <File path="index.html">Index</File>
      <Dir path="blog">
        <Key each={Object.values(ssgState.pages ?? {})} by={(p) => p.modified}>
          {(p) => (
            <Show when={p().title}>
              <File path={`${p().title}.html`}>
                {ssgState.templateEnv.render(p().template, { page: p() })}
              </File>
            </Show>
          )}
        </Key>
      </Dir>
    </>
  );

  return renderFs(fsTree, ssgState.buildDirectory);
}
export async function createSsg(dir, buildDirectory, theme) {
  const [ssgState, setSsgState] = createStore({
    state: STATE.INITIALIZING,
    pages: {},
    directory: dir,
    buildDirectory,
    theme,
    templateEnv: createTemplateEnv(dir.get_child(`themes/${theme}`)),
    taxonomies() {
      deriveTaxonomies(Object.values(ssgState.pages), taxonomies);
    },
  });
  renderSite(ssgState);

  // sync this signal to the main ssg store
  const pagesSignal = usePages(dir);
  createEffect(() => {
    const pages = pagesSignal();
    setSsgState({ pages });
  });

  if (await isDirEmpty(dir)) {
    initSiteDir(dir);
  }

  setSsgState({ state: STATE.READY });

  return ssgState;
}
