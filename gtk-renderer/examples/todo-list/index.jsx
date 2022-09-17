import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import { For } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { render, useGlobalCss, classes, Child } from "gtk-renderer/renderer.js";

const VERTICAL = Gtk.Orientation.VERTICAL;
const HORIZONTAL = Gtk.Orientation.HORIZONTAL;

const [todos, setTodos] = createStore([
  { label: "Fix the bug", done: false },
  { label: "Call Joe", done: false },
]);

function TodoItem(props) {
  return (
    <gtk_ListBoxRow>
      <gtk_Box
        use:classes={{ "todo-item": true, done: props.item.done }}
        orientation={HORIZONTAL}
      >
        <gtk_Entry
          text={props.item.label}
          hexpand={true}
          placeholder-text="What to do?"
          on-changed={(entry) => {
            setTodos(produce((list) => (list[props.index].label = entry.text)));
          }}
        />
        <gtk_Button
          icon-name="edit-delete"
          tooltip-text="Delete this item"
          use:classes="flat hover circular"
          on-clicked={() => {
            setTodos(produce((list) => list.splice(props.index, 1)));
          }}
        />
        <gtk_CheckButton
          active={props.item.done}
          on-toggled={(checkbox) => {
            setTodos(
              produce((list) => (list[props.index].done = checkbox.active))
            );
          }}
        />
      </gtk_Box>
    </gtk_ListBoxRow>
  );
}

function TodoList() {
  return (
    <gtk_ListBox
      selection-mode={Gtk.SelectionMode.NONE}
      use:classes="boxed-list todo-list"
    >
      <For each={todos}>
        {(todo, index) => <TodoItem item={todo} index={index()} />}
      </For>
    </gtk_ListBox>
  );
}

function Window({ application }) {
  return (
    <adw_ApplicationWindow
      application={application}
      default_width={480}
      default_height={640}
    >
      <gtk_Box orientation={VERTICAL} hexpand={true} vexpand={true}>
        <adw_HeaderBar use:classes="flat">
          <Child type="start">
            <gtk_Button
              use:classes="circular"
              icon-name="list-add"
              tooltip-text="Add a new item"
              on-clicked={() => {
                setTodos(
                  produce((list) => list.push({ label: "", done: false }))
                );
              }}
            />
          </Child>
          <Child type="title">
            <adw_WindowTitle title="Todo List" />
          </Child>
        </adw_HeaderBar>
        <TodoList />
      </gtk_Box>
    </adw_ApplicationWindow>
  );
}

let app = new Adw.Application({ application_id: "org.example.TodoList" });
app.connect("activate", () => {
  render(() => {
    const win = <Window application={app} />;
    useGlobalCss(`
      .todo-list {
        margin: 1em;
      }
      .todo-list row {
        padding: 0.5em;
      }
      
      box > .hover {
          opacity: 0;
      }
      
      box:hover > .hover {
          opacity: 1;
      }
      
      .todo-item entry {
          background-color: rgba(0, 0, 0, 0);
      }
      
      .todo-item.done text {
          text-decoration: line-through;
      }
    `);
    win.present();
  }, app);
});

app.run([]);
