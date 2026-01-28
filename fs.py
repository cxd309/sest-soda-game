# File server to test github pages site

from flask import Flask, send_from_directory, abort, Response
from werkzeug.exceptions import NotFound
import os

app = Flask(__name__)
PORT: int = 8080
DOCS_DIR: str = "./docs"


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_file(path: str) -> Response:
    # Default to index.html for root path
    if path == "":
        path = "index.html"

    print(f"/{path} -> {os.path.join(DOCS_DIR, path)}")

    try:
        return send_from_directory(DOCS_DIR, path)
    except FileNotFoundError:
        abort(404)


@app.errorhandler(404)
def not_found(e: NotFound) -> tuple[str, int]:
    return "404 Not Found", 404


if __name__ == "__main__":
    print(f"listening at http://localhost:{PORT}")
    app.run(port=PORT, debug=True)
