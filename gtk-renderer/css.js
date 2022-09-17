import { children, createEffect, onCleanup } from "solid-js";
import Gdk from "gi://Gdk";
import Gtk from "gi://Gtk";

// Example:
// <gtk_Button use:classes="circular flat"/>
// <gtk_Button use:classes={["circular" "flat"]}/>
// <gtk_Button use:classes={{"circular": true, "flat": true}}/>
export function classes(el, classDesc) {
  let defaultClasses;
  createEffect(() => {
    if (!defaultClasses) {
      defaultClasses = el.css_classes;
    }
    const updated = classDesc();
    if (typeof updated === "string") {
      el.css_classes = [...defaultClasses, ...updated.split(" ")];
    } else if (Array.isArray(updated)) {
      el.css_classes = [...defaultClasses, ...updated];
    } else if (typeof updated === "object") {
      el.css_classes = [
        ...defaultClasses,
        ...Object.keys(updated).filter((k) => updated[k]),
      ];
    }
  });
}

export function useGlobalCss(styleSheet) {
  const provider = new Gtk.CssProvider();
  const encoder = new TextEncoder();
  const priority = Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION;
  const display = Gdk.Display.get_default();
  if (!display) {
    throw new Error(
      "Could not get default display while trying to install the CSS stylesheet"
    );
  }

  Gtk.StyleContext.add_provider_for_display(display, provider, priority);

  if (!(styleSheet instanceof Function)) {
    const text = styleSheet;
    styleSheet = () => text;
  }
  createEffect(() => {
    provider.load_from_data(encoder.encode(styleSheet()));
  });
  onCleanup(() => {
    Gtk.StyleContext.remove_provider_for_display(display, provider);
  });
}
