import { For } from "solid-js";
import Gtk from "gi://Gtk";
import { getFileModTime } from "../fs/";

export default function SideBar(props) {
  const pages = () =>
    Object.values(props.posts ?? {})
      .sort((a, b) => a.modified.localeCompare(b.modified))
      .reverse();
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
          <For each={(console.log(pages().map((x) => x.title)), pages())}>
            {(page) => (
              <gtk_ListBoxRow ref={(row) => (row.page = page)}>
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
                    label={page.title}
                  />
                  <gtk_Label
                    halign={Gtk.Align.START}
                    css-classes={["body"]}
                    label="Lorem Ipsum"
                  />
                  <gtk_Label
                    halign={Gtk.Align.START}
                    css-classes={["caption"]}
                    label={page.modified}
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
