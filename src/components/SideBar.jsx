import { createEffect, For } from "solid-js";
import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import { Menu, MenuItem } from "gtk-renderer/Menu.jsx";
import { getFileModTime } from "../fs/index.jsx";
import { Key } from "@solid-primitives/keyed";
import { Child } from "gtk-renderer";

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
        <adw_HeaderBar show-end-title-buttons={false}>
          <Child type="title">
            <gtk_Label label="Posts" />
          </Child>
          <Child type="start">
            <gtk_Button
              icon-name="document-new-symbolic"
              on-clicked={props.onNewFileRequest}
            />
          </Child>
          <Child type="end">
            <gtk_MenuButton
              icon-name="open-menu-symbolic"
              menu-model={
                <Menu>
                  <MenuItem label="About" />
                  <MenuItem label="Themes" detailed-action="win.show-themes" />
                </Menu>
              }
            ></gtk_MenuButton>
          </Child>
        </adw_HeaderBar>
        <gtk_ScrolledWindow
          hscrollbar-policy={Gtk.PolicyType.NEVER}
          propagate-natural-height={true}
        >
          <gtk_ListBox on-row-activated={props.onActivateRow}>
            <Key each={pages()} by={(p) => p.modified}>
              {(page) => {
                let row;
                createEffect(() => {
                  if (row) {
                    row.page = page();
                  }
                });
                return (
                  <gtk_ListBoxRow ref={(r) => (row = r)}>
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
                        label={page().title}
                      />
                      <gtk_Label
                        halign={Gtk.Align.START}
                        css-classes={["body"]}
                        label="Lorem Ipsum"
                      />
                      <gtk_Label
                        halign={Gtk.Align.START}
                        css-classes={["caption"]}
                        label={page().modified}
                      />
                    </gtk_Box>
                  </gtk_ListBoxRow>
                );
              }}
            </Key>
          </gtk_ListBox>
        </gtk_ScrolledWindow>
      </gtk_Box>
    </gtk_Revealer>
  );
}
