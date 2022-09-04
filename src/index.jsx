import {
  createEffect,
  Switch,
  Match,
  createResource,
  createSignal,
  ErrorBoundary,
} from "solid-js";
import { createStore, produce } from "solid-js/store";
import { render } from "gtk-renderer/renderer.js";
import ChooseFolderView from "./components/ChooseFolderView.jsx";
import EditorView from "./components/EditorView.jsx";
import ThemesView from "./components/ThemesView.jsx";
import SideBar from "./components/SideBar.jsx";
import debounce from "lodash/debounce";
import { createSsg } from "./ssg/index.jsx";
import { createServer } from "./ssg/server";
import { listFiles, makeDirStructure } from "./fs/index.jsx";
import AppStateContext from "./AppStateContext.js";

imports.gi.versions["Gtk"] = 4;
imports.gi.versions["Soup"] = 3;
const { Gtk, Adw, Gio, GtkSource, GLib } = imports.gi;

const PKG_NAME = "Genablog";
var Dirs = makeDirStructure(Gio.File.new_for_path("/"), {
  data: GLib.build_filenamev([GLib.get_user_data_dir(), PKG_NAME]),
});

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
      Dirs.data.get_child("session.json").get_path()
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
        Dirs.data.get_child("session.json").get_path(),
        JSON.stringify(state)
      );
    } catch (e) {
      console.error("Writing session file: ", e);
    }
  });

  return [state, setState];
}

function SsgDebugWindow(props) {
  return (
    <adw_Window ref={(x) => x.present()}>
      <gtk_Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        <adw_HeaderBar />
        <gtk_Label label="State" css-classes={["heading"]} />
        <gtk_Label label={props.ssg?.state} />
        <gtk_Label label="Directory" css-classes={["heading"]} />
        <gtk_Label label={props.ssg?.directory.get_path()} />
      </gtk_Box>
    </adw_Window>
  );
}
function AppWindow(props) {
  const [session, setSession] = getSessionStore();
  const [state, setState] = createStore({
    sidebarRevealed: true,
    folder: session.folderPath
      ? Gio.file_new_for_path(session.folderPath)
      : null,
    currentFile: null,
    history: ["main"],
    theme: "simple",
    ssg: null,
    view() {
      return state.history[state.history.length - 1];
    },
    pushView(view) {
      setState(
        produce((state) => {
          state.history.push(view);
        })
      );
    },
    back() {
      setState(
        produce((s) => {
          if (s.history.length > 1) s.history.pop();
        })
      );
    },
  });
  let server = null;

  // Handle state.folder changes
  createEffect(() => {
    const folder = state.folder;
    if (folder != null) {
      setSession({ folderPath: folder.get_path() });

      server?.disconnect();
      server = createServer({ folder });

      try {
        const dirs = makeDirStructure(state.folder, {
          build: "build",
        });
        setState({ ssg: createSsg(folder, dirs.build, state.theme) });
      } catch (e) {
        console.error(e, e.message);
      }
    }
  });

  const handleTextChange = debounce((text) => {
    // print(text);
  }, 500);

  const handleNewFileRequest = () => {
    let file = state.folder.get_child(`content/blog/${Date.now()}.md`);
    file.create(Gio.FileCreateFlags.NONE, null);
    setState({ currentFile: file });
  };

  let leaflet;
  let win;

  return (
    <AppStateContext.Provider value={[state, setState]}>
      <adw_ApplicationWindow
        application={props.app}
        default-width={720}
        default-height={720}
        ref={(x) => {
          const actions = [
            ["show-themes", () => state.pushView("themes")],
            ["back", () => state.back()],
          ];
          for (let a of actions) {
            const [name, callback] = a;
            const action = Gio.SimpleAction.new(name, null);
            action.connect("activate", callback);
            x.add_action(action);
          }

          x.present();
          win = x;
        }}
      >
        <ErrorBoundary fallback={(e) => console.log(e)}>
          <Switch>
            <Match when={state.folder === null}>
              <ChooseFolderView
                parent-window={win}
                onOpenFolder={(folder) => setState({ folder })}
              />
            </Match>
            <Match when={state.view() == "main"}>
              <gtk_Box orientation={Gtk.Orientation.VERTICAL}>
                <adw_Leaflet ref={leaflet}>
                  <SideBar
                    revealed={state.sidebarRevealed}
                    posts={state.ssg?.pages}
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
            <Match when={state.view() == "themes"}>
              <ThemesView />
            </Match>
          </Switch>
        </ErrorBoundary>
      </adw_ApplicationWindow>
    </AppStateContext.Provider>
  );
}

// Create a new application
let app = new Adw.Application({ application_id: "com.ranfdev.Genablog" });
// When the application is launched…
app.connect("activate", () => {
  render(() => <AppWindow app={app} />, app);
});

app.run([]);
