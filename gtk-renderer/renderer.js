import { createRenderer } from "solid-js/universal";
imports.gi.versions.Gtk = "4.0";

const { Gtk, Gio, Adw } = imports.gi;

Object.assign(Gtk.Widget.prototype, {
  getFirstChild() {
    return this.get_first_child();
  },
  getNextSibling() {
    return this.get_next_sibling();
  },
});

Object.assign(Gtk.Box.prototype, {
  insertNode(node, anchor) {
    if (!anchor) {
      this.append(node);
    } else {
      this.insert_child_after(node, anchor.get_prev_sibling());
    }
  },
});
Object.assign(Gtk.ListBox.prototype, {
  insertNode(node, anchor) {
    if (!anchor) {
      this.append(node);
    } else {
      this.insert(node, anchor.get_index());
    }
  },
});
Object.assign(Gtk.ListBoxRow.prototype, {
  getNextSibling() {
    return this.get_parent().get_row_at_index(this.get_index() + 1);
  },
});
Object.assign(Adw.Leaflet.prototype, {
  insertNode(node, anchor) {
    if (!anchor) {
      this.append(node);
    } else {
      this.insert_child_after(node, anchor.get_next_sibling() || null); // apparently the siblings are inverted (next, not prev)...
    }
  },
});
Object.assign(Gtk.Stack.prototype, {
  insertNode(node, anchor) {
    this.add_child(node);
  },
});
Object.assign(Adw.Window.prototype, {
  getFirstChild() {
    return this.content;
  },
});
Object.assign(Adw.ApplicationWindow.prototype, {
  getFirstChild() {
    return this.content;
  },
});
Object.assign(Gio.Menu.prototype, {
  insertNode(node, anchor) {
    this.append_item(node);
  },
});
export const {
  render,
  effect,
  memo,
  use,
  createComponent,
  createElement,
  createTextNode,
  insertNode,
  insert,
  spread,
  setProp,
  mergeProps,
} = createRenderer({
  createElement(string) {
    console.log("createElement", string);
    let uscore = string.indexOf("_");
    let namespace = string.substring(0, uscore);
    namespace = namespace.replace(string[0], string[0].toUpperCase());
    const imported = imports.gi[namespace];

    return new imported[string.substring(uscore + 1)]();
  },
  createTextNode(value) {
    console.log("createTextNode");
    return new Gtk.Label({ label: value });
  },
  replaceText(textNode, value) {
    console.log("replaceText");
    textNode.label = value;
  },
  setProperty(node, name, value) {
    if (name.startsWith("on-")) {
      if (Object.hasOwnProperty(node, name)) {
        node.disconnect(node[name]);
      }
      node[name] = node.connect(name.substr(3), value);
    } else {
      node[name] = value;
    }
  },
  insertNode(parent, node, anchor) {
    console.log("insertNode");
    if (parent.insertNode) {
      parent.insertNode(node, anchor);
    } else if (parent.set_content) {
      parent.set_content(node);
    } else if (parent.set_child) {
      parent.set_child(node);
    } else if (parent.add_child) {
      parent.add_child(node);
    } else if (parent.append) {
      parent.append(node);
    }
  },
  isTextNode(node) {
    console.log("isTextNode");
    return node instanceof Gtk.Label;
  },
  removeNode(parent, node) {
    console.log("removeChild");
    if (parent.removeChild) {
      parent.removeChild(node);
    } else if (parent.remove) {
      parent.remove(node);
    } else if (parent.set_content && parent.content === node) {
      parent.set_content(null);
    } else if (parent.set_child && parent.child === node) {
      print(parent.set_child, parent.child, node);

      parent.set_child(null);
    }
  },
  getParentNode(node) {
    console.log("getParentNode");
    return node.get_parent();
  },
  getFirstChild(node) {
    print("getFirstChild");
    return node.getFirstChild();
  },
  getNextSibling(node) {
    console.log("getNextSibling");
    return node.getNextSibling();
  },
});

// Forward Solid control flow
export {
  For,
  Show,
  Suspense,
  SuspenseList,
  Switch,
  Match,
  Index,
  ErrorBoundary,
} from "solid-js";

export function propertyBind(obj, value) {
  const [property, setField] = value();
  setField(obj[property]);
  obj.connect(`notify::${property}`, (obj, _) => setField(obj[property]));
}
