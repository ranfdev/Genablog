import Gio from "gi://Gio"
export function Menu(props) {
  return <gio_Menu ref={props.ref}>
    {props.children}
  </gio_Menu>
}

// This is a workaround.
// Gio.MenuItem can't be used directly as a native element, because
// its not a GObject and its values (not properties) must be set _before_ the MenuItem is added
// to a Gio.Menu. Without this wrapper, SolidJS would set the MenuItem values _after_
// appending the items to the menu, resulting in a broken state.
export function MenuItem(props) {
  const item = new Gio.MenuItem();
  for (const [key, value] of Object.entries(props)) {
    item[`set_${key.replace("-", "_")}`](value);
  }
  return item;
}
