import { createEffect, createSignal, untrack } from "solid-js";
import Gtk from "gi://Gtk";
import GtkSource from "gi://GtkSource";
import GLib from "gi://GLib";
import { promiseTask } from "troll/src/util.js";
import { Child } from "gtk-renderer";

export default function EditorView(props) {
  const [edited, setEdited] = createSignal(false);

  let view;
  let lastFile;

  function save(f) {
    try {
      GLib.file_set_contents(f.get_path(), view.buffer.text);
      setEdited(false);
    } catch (e) {
      console.error("Saving edited file: ", e);
    }
  }

  createEffect(() => {
    if (view != null && props.currentFile != null) {
      promiseTask(
        props.currentFile,
        "load_contents_async",
        "load_contents_finish",
        null
      )
        .then(([_f, contents, _]) => {
          if (lastFile != null && untrack(edited)) {
            save(lastFile);
          }

          lastFile = props.currentFile;

          const text_decoder = new TextDecoder("utf-8");
          const text = text_decoder.decode(contents);
          view.buffer.set_text(text, text.length);
          setEdited(false); // The file was just opened, enforce it's not edited.
        })
        .catch((e) => console.error("Error opening file: ", e, e.message));
    }
  });

  return (
    <gtk_Box orientation={Gtk.Orientation.VERTICAL} width-request={270}>
      <adw_HeaderBar css-classes={["flat"]}>
        <Child type="start">
          <gtk_Button
            icon-name="sidebar-show-symbolic"
            on-clicked={(e) => props.setSidebarRevealed((x) => !x)}
          />
          <gtk_Button
            sensitive={edited()}
            icon-name="drive-harddisk-system-symbolic"
            on-clicked={() => save(props.currentFile)}
          />
        </Child>
        <Child type="end">
          <gtk_Button
            icon-name="eye-open-negative-filled-symbolic"
            on-clicked={() =>
              Gtk.show_uri(
                null,
                `http://localhost:1080/blog/${props.currentFile.get_basename()}`,
                0
              )
            }
          />
        </Child>
      </adw_HeaderBar>
      <gtk_ScrolledWindow>
        <gtkSource_View
          ref={(_view) => {
            view = _view;

            let langmg = GtkSource.LanguageManager.get_default();
            langmg.append_search_path("./data/");
            let lang = langmg.get_language("markdown");
            print(lang, lang.get_name());
            view.buffer.set_language(lang);

            let stylemg = GtkSource.StyleSchemeManager.get_default();
            stylemg.append_search_path("./data/");
            let theme = stylemg.get_scheme("adwaita_md");
            view.buffer.set_style_scheme(theme);

            view.buffer.connect("notify::text", () => {
              setEdited(true);
              props.onChange(view.buffer.text);
            });
          }}
          wrap-mode={Gtk.WrapMode.CHAR}
          hexpand={true}
          vexpand={true}
          top-margin={8}
          bottom-margin={8}
          left-margin={8}
          right-margin={8}
          width-request={340}
        ></gtkSource_View>
      </gtk_ScrolledWindow>
    </gtk_Box>
  );
}
