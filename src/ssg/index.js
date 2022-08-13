import * as nunjucks from "nunjucks/browser/nunjucks";
import GLib from "gi://GLib";
import Gio from "gi://Gio";
import buffer from "buffer";
import { marked } from "marked";
import matter from "gray-matter";
import { promiseTask } from "troll/src/util.js";

const RequiredFolders = ["content/blog", "themes", "static"];
const RequiredFiles = ["config.toml"];
var decoder = new TextDecoder();

globalThis.Buffer = buffer.Buffer;

async function* listFiles(folder, chunkSize = 4) {
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

async function readPages(folder) {
  const contentFolder = folder.get_child("content/blog");
  const en = listFiles(contentFolder);
  const pages = [];

  for await (let fi of en) {
    const f = contentFolder.get_child(fi.get_name());
    const [_ok, contents] = f.load_contents(null);
    const m = matter(decoder.decode(contents));
    const page = {
      ...m.data,
      template: m.data.template ?? "index.html",
      path: f.get_path(),
      content: marked(m.content),
    };
    pages.push(page);
  }
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
      deriveTaxonomies(pages, taxonomies);
    },
    render() {
      for (let p of pages) {
        console.log(env.render(p.template, {page: p}))
      }
    },
  };
}
