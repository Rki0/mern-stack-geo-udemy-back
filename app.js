const http = require("http");

const server = http.createServer((req, res) => {
  console.log("INCOMING REQUEST");
  console.log(req.method, req.url);

  if (req.method === "POST") {
    let body = "";

    req.on("end", () => {
      const userName = body.split("=")[1];
      res.end(`<h1>${userName}</h1>`);
    });

    req.on("data", (chunk) => {
      body += chunk;
    });
  } else {
    // res.end로 전달하는 것이 html 태그가 아니라 그냥 평문이라는 것을 알려주고자 하는 것
    // res.setHeader("Content-Type", "text/plain");

    // text/html을 적어주면 html로 작동함.
    res.setHeader("Content-Type", "text/html");

    // res.end("<h1>Success!</h1>");
    res.end(
      '<form method="POST"><input type="text" name="username" /><button type="submit">Create User</button></form>'
    );
  }
});

server.listen(5000);
