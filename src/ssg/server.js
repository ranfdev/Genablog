import Soup from "gi://Soup?version=3.0";
import GLib from "gi://GLib";

const decoder = new TextDecoder();
function handler(folder) {
  return (_server, msg, path, _query) => {
    try {
      msg.set_status(200, null);
      console.log(filePath);

      const resolvedPath = folder.get_child(`content/blog/${filePath}.md`).get_path();
      let [_ok, contents] = GLib.file_get_contents(resolvedPath);
      contents = decoder.decode(contents);

      msg
        .get_response_headers()
        .set_content_type("text/html", { charset: "UTF-8" });
      msg.get_response_body().append(`
            <html>
            <body>
                ${contents}
            </body>
            </html>
        `);
    } catch (e) {
      console.error("Serving file: ", e, e.message);
    }
  };
}

export function createServer({ folder }) {
  const server = new Soup.Server();
  server.add_handler("/", (server, msg, path, query) => {
    msg
        .get_response_headers()
        .set_content_type("text/html", { charset: "UTF-8" });
      msg.get_response_body().append(`
            <html>
            <body>
                You can only preview the current blog post
            </body>
            </html>
        `);
  });
  server.add_handler("/blog/", handler(folder));

  server.listen_local(1080, Soup.ServerListenOptions.IPV4_ONLY);
  return server;
}
