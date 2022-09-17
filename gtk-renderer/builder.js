import { children, createEffect, on } from "solid-js";
import { diff, MoveType } from "./childdiff";
import { APPLY_PARENT_SYM, removeNode } from "./renderer";
import Gtk from "gi://Gtk";

const Builder = new Gtk.Builder();

export function Child(props) {
  let resolvedChildren = children(() => props.children);
  let lastChildren = resolvedChildren.toArray();
  let parentContainer = null;
  let startChild;

  createEffect(
    on(
      resolvedChildren,
      (resolvedChildren) => {
        let lastChildrenSet = new Set(lastChildren);
        const moves = diff(lastChildren, resolvedChildren);
        lastChildren = resolvedChildren;
        moves.forEach((move) => {
          if (move.type === MoveType.Remove) {
            removeNode(parentContainer, move.item);
          } else if (!lastChildrenSet.has(move.item)) {
            parentContainer.vfunc_add_child(
              Builder,
              move.item,
              props.type ?? null
            );
          } else {
            move.item.insert_after(parentContainer, move.after);
          }
        });
      },
      { defer: true }
    )
  );

  function applyFun(parentCaller) {
    for (let c of lastChildren) {
      parentCaller.vfunc_add_child(Builder, c, props.type ?? null);
    }
    if (lastChildren.length > 0) {
      parentContainer = lastChildren[0].get_parent();
      startChild = parentContainer.get_last_child();
    }
  }
  return {
    [APPLY_PARENT_SYM]: applyFun,
  };
}
