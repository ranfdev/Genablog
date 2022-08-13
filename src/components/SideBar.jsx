import { For } from "solid-js";
import Gtk from "gi://Gtk";

export default function SideBar(props) {
  const getFileModTime = (f) => {
    let t = f.get_modification_date_time() ?? f.get_creation_date_time();
    return t.format("%d %B %Y");
  };
  return (
    <gtk_Revealer
      reveal-child={props.revealed}
      transition-type={Gtk.RevealerTransitionType.SLIDE_RIGHT}
    >
      <gtk_Box width-request={270} orientation={Gtk.Orientation.VERTICAL}>
        <adw_HeaderBar
          ref={(hb) => {
            hb.pack_start(
              <gtk_Button
                icon-name="document-new-symbolic"
                on-clicked={props.onNewFileRequest}
              />
            );
            hb.pack_end(
              <gtk_MenuButton
                icon-name="open-menu-symbolic"
                menu-model={
                  <gio_Menu
                    ref={(m) => {
                      m.append("Themes", "win.show-themes");
                      m.append("About", null);
                    }}
                  ></gio_Menu>
                }
              ></gtk_MenuButton>
            );
          }}
          title-widget={<gtk_Label label="Posts" />}
          show-end-title-buttons={false}
        />
        <gtk_ListBox on-row-activated={props.onActivateRow}>
          <For each={props.posts}>
            {(file) => (
              <gtk_ListBoxRow ref={(row) => (row.file = file)}>
                <gtk_Box
                  margin-top={16}
                  margin-bottom={16}
                  margin-start={8}
                  margin-end={8}
                  orientation={Gtk.Orientation.VERTICAL}
                >
                  <gtk_Label
                    halign={Gtk.Align.START}
                    css-classes={["heading"]}
                    label={file.get_name()}
                  />
                  <gtk_Label
                    halign={Gtk.Align.START}
                    css-classes={["body"]}
                    label="Lorem Ipsum"
                  />
                  <gtk_Label
                    halign={Gtk.Align.START}
                    css-classes={["caption"]}
                    label={getFileModTime(file)}
                  />
                </gtk_Box>
              </gtk_ListBoxRow>
            )}
          </For>
        </gtk_ListBox>
      </gtk_Box>
    </gtk_Revealer>
  );
}