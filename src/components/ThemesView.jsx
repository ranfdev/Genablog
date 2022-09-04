import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import GdkPixbuf from "gi://GdkPixbuf";
import {
  createEffect,
  createResource,
  createSignal,
  ErrorBoundary,
  onError,
  Show,
} from "solid-js";

import fetch from "troll/src/std/fetch.js";
import { delay } from "troll/src/util.js";
import { useAppState } from "../AppStateContext";

const THEMES = [
  {
    name: "terminimal",
    description: "A simple, minimal retro theme",
    license: "MIT",
    homepage: "https://github.com/pawroman/zola-theme-terminimal",
    min_version: "0.11.0",
    author: {
      name: "Paweł Romanowski",
      homepage: "https://github.com/pawroman",
    },
    demo: "https://pawroman.github.io/zola-theme-terminimal/",
    screenshot:
      "https://raw.githubusercontent.com/pawroman/zola-theme-terminimal/master/screenshot.png",
    repository: "https://github.com/pawroman/zola-theme-terminimal.git",
  },
  {
    name: "even",
    description: "A robust, elegant dark theme",
    license: "MIT",
    homepage: "https://github.com/getzola/even",
    min_version: "0.16.0",
    demo: "https://zola-even.netlify.com",
    author: {
      name: "Vincent Prouillet",
      homepage: "https://www.vincentprouillet.com",
    },
    repository: "https://github.com/getzola/even.git",
    screenshot:
      "https://github.com/getzola/even/blob/master/screenshot.png?raw=true",
  },
];

const placeholderTheme = {
  name: "Loading...",
};

async function fetchPixbuf(
  url,
  options = { width: -1, height: -1, preserveAspectRatio: true }
) {
  try {
    const res = await fetch(url);
    const bytes = await res.gBytes();
    const pixbuf = GdkPixbuf.Pixbuf.new_from_stream_at_scale(
      Gio.MemoryInputStream.new_from_bytes(bytes),
      options.width,
      options.height,
      options.preserveAspectRatio,
      null
    );
    return pixbuf;
  } catch (e) {
    console.log(e);
  }
}
function RemoteImage(props) {
  const [pixbuf] = createResource(async () => {
    if (props.src) {
      return await fetchPixbuf(props.src, {
        width: props["width-request"],
        height: props["height-request"],
      });
    } else {
      return null;
    }
  });
  const [picture, setPicture] = createSignal(null);
  createEffect(() => {
    if (picture()) {
      picture().set_pixbuf(pixbuf() || null);
    }
  });
  return (
    <ErrorBoundary
      fallback={(e) => (
        console.error(e),
        (
          <gtk_Image
            width-request={props["width-request"]}
            height-request={props["height-request"]}
            icon-name="image-missing"
          />
        )
      )}
    >
      <gtk_Picture
        ref={setPicture}
        width-request={props["width-request"]}
        height-request={props["height-request"]}
      />
    </ErrorBoundary>
  );
}

function presentThemeInfo(parent, theme) {
  const dialog = (
    <adw_Window
      default-width={360}
      default-height={640}
      ref={(x) => x.present()}
      transient-for={parent}
      modal={true}
    >
      <gtk_Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
        <adw_HeaderBar title={theme.name} />
        <gtk_Box
          orientation={Gtk.Orientation.VERTICAL}
          margin-top={16}
          margin-bottom={16}
          margin-start={16}
          margin-end={16}
          spacing={8}
        >
          <gtk_Label
            css-classes={["title-2"]}
            label={theme.name}
            wrap={true}
            xalign={0.0}
          />
          <RemoteImage src={theme.screenshot} />

          <gtk_Label label={theme.description} wrap={true} xalign={0.0} />
          <gtk_Label
            label={`License: ${theme.license}`}
            wrap={true}
            xalign={0.0}
          />
          <gtk_Label
            label={`Author: ${theme.author.name}`}
            wrap={true}
            xalign={0.0}
          />
          <gtk_Box spacing={8} margin-top={8} homogeneous={true}>
            <gtk_LinkButton
              uri={theme.homepage}
              label="Homepage"
              css-classes={["pill"]}
            />
            <Show when={theme.demo}>
              <gtk_LinkButton
                uri={theme.demo}
                label="Online Demo"
                css-classes={["pill"]}
              />
            </Show>
          </gtk_Box>

          <gtk_Button
            label="Install"
            css-classes={["suggested-action", "pill"]}
          />
        </gtk_Box>
      </gtk_Box>
    </adw_Window>
  );
}

function installTheme(dir, gitUrl, name) {
  console.log("Installing theme", name, "from", gitUrl, "to", dir);
  const proc = Gio.Subprocess.new(
    ["git", "clone", gitUrl, dir.get_child(name).get_path()],
    Gio.SubprocessFlags.NONE
  );
  return proc.wait(null);
}
function ThemeCard(props) {
  let modalParent;
  createEffect(() => {
    modalParent = modalParent.get_root();
  });
  return (
    <gtk_Box css-classes={["card"]} orientation={Gtk.Orientation.VERTICAL}>
      {/* Will need to set GtkPicture content-fit="cover" once I have GTK 4.8 */}
      <RemoteImage
        width-request={270}
        height-request={135}
        src={props.theme.screenshot}
      />
      <gtk_Box
        margin-start={8}
        margin-end={8}
        margin-top={8}
        margin-bottom={8}
        spacing={8}
        hexpand={true}
      >
        <gtk_Label
          css-classes={["heading"]}
          halign={Gtk.Align.START}
          hexpand={true}
          label={props.theme.name}
        />
        <gtk_Button
          ref={(x) => (modalParent = x)}
          halign={Gtk.Align.END}
          css-classes={["icon-button", "flat"]}
          icon-name="dialog-information-symbolic"
          on-clicked={() => presentThemeInfo(modalParent, props.theme)}
        />
        <gtk_Button
          halign={Gtk.Align.END}
          css-classes={["icon-button", "flat"]}
          icon-name="folder-download-symbolic"
          on-clicked={() =>
            installTheme(
              props.themeDirectory,
              props.theme.repository,
              props.theme.name
            )
          }
        />
      </gtk_Box>
    </gtk_Box>
  );
}
export default function ThemesView(props) {
  const [appState] = useAppState();
  const [themes] = createResource(async () => {
    await delay(500);
    return THEMES;
  });
  return (
    <gtk_Box orientation={Gtk.Orientation.VERTICAL}>
      <gtk_HeaderBar
        ref={(hb) => {
          hb.pack_start(
            <gtk_Button
              icon-name="go-previous-symbolic"
              action-name="win.back"
            />
          );
        }}
      />
      <gtk_FlowBox
        margin-start={8}
        margin-end={8}
        margin-top={8}
        margin-bottom={8}
        row-spacing={4}
        column-spacing={4}
        selection-mode={Gtk.SelectionMode.NONE}
        homogeneous={true}
        sensitive={!themes.loading}
      >
        <Show
          when={!themes.loading}
          fallback={() => (
            <>
              <ThemeCard theme={placeholderTheme} />
              <ThemeCard theme={placeholderTheme} />
              <ThemeCard theme={placeholderTheme} />
            </>
          )}
        >
          {themes().map((theme) => (
            <ThemeCard
              themeDirectory={appState.folder.get_child("themes")}
              theme={theme}
            />
          ))}
        </Show>
      </gtk_FlowBox>
    </gtk_Box>
  );
}
