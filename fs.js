// File server to test github pages site

import http from 'http';
import url from 'url';
import fs from 'fs';
import mime from 'mime/lite';

http.createServer(function (req, res) {
  var q = url.parse(req.url, true);
  var filename = "./docs" + q.pathname;
  console.log(filename)
  fs.readFile(filename, function(err, data) {
    if (err) {
      res.writeHead(404, {'Content-Type': 'text/html'});
      return res.end("404 Not Found");
    } 
    res.writeHead(200, {'Content-Type': mime.getType(filename)});
    res.write(data);
    return res.end();
  });
}).listen(8080);