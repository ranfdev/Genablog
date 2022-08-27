import { createEffect, Switch, Match, createResource, createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { render } from "gtk-renderer/renderer.js";
import ChooseFolderView from "./components/ChooseFolderView.jsx";
import EditorView from "./components/EditorView.jsx";
import ThemesView from "./components/ThemesView.jsx";
import SideBar from "./components/SideBar.jsx";
import debounce from "lodash/debounce";
import { createSSG } from "./ssg/index";
import { createServer } from "./ssg/server";
import { listFiles } from "./fs/index.js";

imports.gi.versions["Gtk"] = 4;
imports.gi.versions["Soup"] = 3;
const { Gtk, Adw, Gio, GtkSource, GLib } = imports.gi;

const PKG_NAME = "Genablog";
var DataDir = Gio.file_new_for_path(
  GLib.build_filenamev([GLib.get_user_data_dir(), PKG_NAME])
);
var win;

if (typeof globalThis.queueMicrotask !== "function") {
  globalThis.queueMicrotask = function (callback) {
    Promise.resolve()
      .then(callback)
      .catch((e) =>
        setTimeout(() => {
          throw e;
        })
      ); // report exceptions
  };
}

function getSessionStore() {
  const [state, setState] = createStore({
    folderPath: null,
  });

  try {
    const [_ok, contents] = GLib.file_get_contents(
      DataDir.get_child("session.json").get_path()
    );
    const dec = new TextDecoder();
    setState(JSON.parse(dec.decode(contents)));
  } catch (e) {
    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
      console.error("Reading session file: ", e, e.message);
  }

  createEffect(() => {
    try {
      GLib.file_set_contents(
        DataDir.get_child("session.json").get_path(),
        JSON.stringify(state)
      );
    } catch (e) {
      console.error("Writing session file: ", e);
    }
  });

  return [state, setState];
}

function AppWindow(props) {
  try {
    DataDir.make_directory_with_parents(null);
  } catch (e) {
    if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.EXISTS))
      error(`Failed to create directory ${e}`);
  }

  const [session, setSession] = getSessionStore();
  const [state, setState] = createStore({
    sidebarRevealed: true,
    folder: session.folderPath
      ? Gio.file_new_for_path(session.folderPath)
      : null,
    posts: null,
    currentFile: null,
    view: "main",
  });
  let server = null;
  let [ssg, setSSG] = createSignal(null);

  createEffect(async () => {
    const folder = state.folder;
    console.log("FOLDER", folder);
    if (folder != null) {
      setSession({ folderPath: folder.get_path() });

      server?.disconnect();
      server = createServer({ folder });

      try {
        setSSG(await createSSG(folder, "simple"));
      } catch (e) {
        console.error(e, e.message);
      }
    }
  });

  createEffect(() => {
    if (!!ssg()) {
      ssg().render()
      setState({posts: ssg().pages()});
    }
  })

  const handleTextChange = debounce((text) => {
    print(text);
  }, 500);

  const handleNewFileRequest = () => {
    let file = state.folder.get_child(`content/blog/${Date.now()}.md`);
    file.create(Gio.FileCreateFlags.NONE, null);
    setState({ currentFile: file });
  };

  let leaflet;
  let win;

  return (
    <adw_ApplicationWindow
      application={props.app}
      default_width={720}
      default_height={720}
      ref={(x) => {
        let a = new Gio.SimpleAction({
          name: "show-themes",
        });
        a.connect("activate", () => setState({ view: "themes" }));
        x.add_action(a);

        x.present();
        win = x;
      }}
    >
      <Switch>
        <Match when={state.folder === null}>
          <ChooseFolderView parent-window={win} onOpenFolder={(folder) => setState({ folder })} />
        </Match>
        <Match when={state.view == "main"}>
          <gtk_Box orientation={Gtk.Orientation.VERTICAL}>
            <adw_Leaflet ref={leaflet}>
              <SideBar
                revealed={state.sidebarRevealed}
                posts={state.posts ? state.posts : null}
                onNewFileRequest={handleNewFileRequest}
                onActivateRow={(_listbox, row) =>
                  setState({
                    currentFile: Gio.File.new_for_path(row.page.path),
                  })
                }
              />
              <gtk_Separator
                ref={(w) => leaflet.get_page(w).set_navigatable(false)}
                orientation={Gtk.Orientation.VERTICAL}
              />
              <EditorView
                setSidebarRevealed={() =>
                  setState((s) => ({ sidebarRevealed: !s.sidebarRevealed }))
                }
                onChange={handleTextChange}
                currentFile={state.currentFile}
              />
            </adw_Leaflet>
          </gtk_Box>
        </Match>
        <Match when={state.view == "themes"}>
          <ThemesView />
        </Match>
      </Switch>
    </adw_ApplicationWindow>
  );
}

// Create a new application
let app = new Adw.Application({ application_id: "com.examp.GtkApplication" });
// When the application is launched…
app.connect("activate", () => {
  render(() => <AppWindow app={app} />, app);
});

app.run([]);
