// Inspired from https://github.com/bodil/gx/blob/master/examples/number-goes-up/src/main.tsx

import { render, classes } from "../../renderer";
import Gtk from "gi://Gtk";
import Adw from "gi://Adw";
import { createSignal } from "solid-js";

const Window = (props) => {
  const [count, setCount] = createSignal(0);
  return (
    <adw_ApplicationWindow
      application={props.app}
      default_width={300}
      default_height={100}
    >
      <gtk_Box orientation={Gtk.Orientation.VERTICAL} hexpand={true}>
        <adw_HeaderBar title-widget={<adw_WindowTitle title="Counter" />} />
        <gtk_Box
          use:classes="linked"
          margin_bottom={16}
          margin_top={16}
          margin_start={16}
          margin_end={16}
        >
          <gtk_Button on-clicked={() => setCount((s) => s - 1)} label="Dec" />
          <gtk_Entry editable={false} text={count().toString()} />
          <gtk_Button on-clicked={() => setCount((s) => s + 1)} label="Inc" />
        </gtk_Box>
      </gtk_Box>
    </adw_ApplicationWindow>
  );
};

let app = new Adw.Application({ application_id: "org.example.Test" });
app.connect("activate", () => {
  render(() => {
    const win = <Window app={app} />;
    win.present();
  }, app);
});

app.run([]);
