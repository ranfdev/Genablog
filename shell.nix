{ pkgs ? import <nixpkgs> { } }:
with pkgs;
mkShell {
  buildInputs = [
    nodejs
    gjs
    glib
    gtk4
    libadwaita
    libsoup_3
    gtksourceview5
    gobject-introspection
  ];
}
