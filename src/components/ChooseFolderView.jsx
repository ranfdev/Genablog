import Gtk from "gi://Gtk"
import Adw from "gi://Adw"


export default function ChooseFolderView(props) {
  return (
    <gtk_Box orientation={Gtk.Orientation.VERTICAL}>
      <adw_HeaderBar />
      <adw_StatusPage
        vexpand={true}
        icon-name="folder-symbolic"
        title="Choose a folder"
        description="Choose were you want to save your blog locally"
      >
        <gtk_Button
          css-classes={["suggested-action", "text-button", "pill"]}
          label="Open Folder"
          on-clicked={() => {
            let fc = new Gtk.FileChooserNative({
              title: "Choose blog folder",
              transient_for: props["parent-window"],
              modal: true,
              create_folders: true,
              action: Gtk.FileChooserAction.SELECT_FOLDER,
            });
            fc.show();
            fc.connect("response", () =>
              props.onOpenFolder(fc.get_current_folder())
            );
          }}
        />
      </adw_StatusPage>
    </gtk_Box>
  );
}
