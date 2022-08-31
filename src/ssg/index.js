import * as nunjucks from "nunjucks/browser/nunjucks";
import GLib from "gi://GLib";
import buffer from "buffer";
import { marked } from "marked";
import matter from "gray-matter";
import { getFileModTime, listFiles, makeDirStructure } from "../fs/index.js";
import { createEffect, createSignal } from "solid-js";
import Gio from "gi://Gio";
import { produce } from "solid-js/store";

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
  const fi = f.query_info(
    Gio.FILE_ATTRIBUTE_TIME_MODIFIED,
    Gio.FileQueryInfoFlags.NONE,
    null
  );
  return readPageFull(f, fi);
}
async function readPages(dir) {
  const contentDir = dir.get_child("content/blog");
  const en = listFiles(contentDir);
  const initialPages = {};

  for await (let fi of en) {
    const f = contentDir.get_child(fi.get_name());
    initialPages[f.get_path()] = readPageFull(f, fi);
  }

  const [pages, setPages] = createSignal(initialPages);
  const monitor = contentDir.monitor_directory(
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

export async function createSSG(dir, theme) {
  if (await isDirEmpty(dir)) {
    initSiteDir(dir);
  }
  const themeFolder = dir.get_child(`themes/${theme}`);
  const env = createTemplateEnv(themeFolder);
  const pages = await readPages(dir);

  return {
    taxonomies() {
      deriveTaxonomies(Object.values(pages()), taxonomies);
    },
    renderToDir(dir) {
      for (let p of Object.values(pages())) {
        const rendered = env.render(p.template, { page: p });
        const title = p.title;
        const dirs = makeDirStructure(dir, { blog: "blog" });
        const outPath = dirs.blog.get_child(`${title}.html`).get_path();
        GLib.file_set_contents(outPath, rendered);
      }
    },
    pages() {
      return pages();
    },
  };
}
