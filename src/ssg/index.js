import * as nunjucks from "nunjucks/browser/nunjucks";
import GLib from "gi://GLib";
import buffer from "buffer";
import { marked } from "marked";
import matter from "gray-matter";
import { getFileModTime, listFiles } from "../fs/index.js";
import { createEffect, createSignal } from "solid-js";
import Gio from "gi://Gio";
import { produce } from "solid-js/store";

const RequiredFolders = ["content/blog", "themes", "static"];
const RequiredFiles = ["config.toml"];
var decoder = new TextDecoder();

globalThis.Buffer = buffer.Buffer;

function initSiteFolder(siteFolder) {
  for (let fi of RequiredFolders) {
    let f = siteFolder.get_child(fi);
    if (!f.query_exists(null)) {
      f.make_directory_with_parents(null);
    }
  }
  for (let fi of RequiredFiles) {
    let f = siteFolder.get_child(fi);
    if (!f.query_exists(null)) {
      GLib.file_set_contents(f.get_path(), "");
    }
  }
}

async function isFolderEmpty(siteFolder) {
  return !!(await listFiles(siteFolder).next());
}

function createTemplateEnv(themeFolder) {
  let Loader = nunjucks.Loader.extend({
    getSource: function (name) {
      const path = themeFolder.get_path() + "/" + name;
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
  const m = matter(decoder.decode(contents));
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
  const fi = f.query_info(Gio.FILE_ATTRIBUTE_TIME_MODIFIED, Gio.FileQueryInfoFlags.NONE, null);
  return readPageFull(f, fi);
}
async function readPages(folder) {
  const contentFolder = folder.get_child("content/blog");
  const en = listFiles(contentFolder);
  const initialPages = {};

  for await (let fi of en) {
    const f = contentFolder.get_child(fi.get_name());
    initialPages[f.get_path()] = readPageFull(f, fi);
  }

  const [pages, setPages] = createSignal(initialPages);
  const monitor = contentFolder.monitor_directory(
    Gio.FileMonitorFlags.WATCH_MOVES,
    null
  );
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
          setPages({
            ...pages(),
            [other_file.get_path()]: readPage(other_file),
          });
        } catch (e) {
          console.warn("Error reading changed file: ", e, e.message);
        }
      }
      if (!isTempFile(file)) {
        const newPages = { ...pages() };
        delete newPages[file.get_path()];
        setPages(newPages);
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
          setPages({ ...pages(), [file.get_path()]: readPage(file) });
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
        const newPages = { ...pages() };
        delete newPages[file.get_path()];
        setPages(newPages);
      }
    }
  });

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

export async function createSSG(folder, theme) {
  if (await isFolderEmpty(folder)) {
    initSiteFolder(folder);
  }
  const themeFolder = folder.get_child(`themes/${theme}`);
  const env = createTemplateEnv(themeFolder);
  const pages = await readPages(folder);

  return {
    taxonomies() {
      deriveTaxonomies(Object.values(pages()), taxonomies);
    },
    render() {
      console.log("RERENDER", Object.values(pages()).length);
      for (let p of Object.values(pages())) {
        console.log(env.render(p.template, { page: p }));
      }
    },
    pages() {
      return pages();
    },
  };
}
