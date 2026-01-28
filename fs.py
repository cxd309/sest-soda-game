# File server to test github pages site

from flask import Flask, send_from_directory

DOCS_DIR: str = "docs"

app = Flask(__name__, static_folder=DOCS_DIR, static_url_path="")


@app.route("/")
def index():
    return send_from_directory("docs", "index.html")


if __name__ == "__main__":
    app.run()
