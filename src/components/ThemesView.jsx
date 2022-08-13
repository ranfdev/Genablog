import Gtk from "gi://Gtk";

function ThemeCard(props) {
  return (
    <gtk_Box css-classes={["card"]} orientation={Gtk.Orientation.VERTICAL}>
      <gtk_Box
        margin-start={16}
        margin-end={16}
        margin-top={16}
        margin-bottom={16}
      ></gtk_Box>
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
          label={props.title}
        />
        <gtk_Button
          halign={Gtk.Align.END}
          css-classes={["icon-button", "flat"]}
          icon-name="folder-download-symbolic"
        />
      </gtk_Box>
    </gtk_Box>
  );
}
export default function ThemesView() {
  return (
    <gtk_Box orientation={Gtk.Orientation.VERTICAL}>
      <gtk_HeaderBar title="Themes" />
      <gtk_FlowBox
        margin-start={8}
        margin-end={8}
        margin-top={8}
        margin-bottom={8}
        row-spacing={4}
        column-spacing={4}
        selection-mode={Gtk.SelectionMode.NONE}
      >
        <ThemeCard title="Simple.css" />
        <ThemeCard title="gruvbox" />
      </gtk_FlowBox>
    </gtk_Box>
  );
}
