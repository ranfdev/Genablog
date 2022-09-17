import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import { render, useGlobalCss } from "gtk-renderer/renderer.js";
import { createSignal } from "solid-js";

function Window({ application }) {
  const [color, setColor] = createSignal("#FFFFFF");
  useGlobalCss(
    () => `
  * {
    background-color: ${color()};
  }`
  );
  return (
    <adw_ApplicationWindow
      application={application}
      default-width={200}
      default-height={100}
    >
      <gtk_Box
        spacing={8}
        margin-start={8}
        margin-end={8}
        margin-top={8}
        margin-bottom={8}
        hexpand={true}
        orientation={Gtk.Orientation.VERTICAL}
        vexpand={true}
      >
        <adw_HeaderBar
          css-classes={["flat"]}
          title-widget={<adw_WindowTitle title="Themer" />}
        ></adw_HeaderBar>
        <gtk_Label label="Type a color name or hex code" />
        <gtk_Entry
          on-changed={(entry) => {
            setColor(entry.text);
          }}
        ></gtk_Entry>
      </gtk_Box>
    </adw_ApplicationWindow>
  );
}

let app = new Adw.Application({ application_id: "org.example.TodoList" });
app.connect("activate", () => {
  render(() => {
    const win = <Window application={app} />;
    win.present();
  }, app);
});

app.run([]);
