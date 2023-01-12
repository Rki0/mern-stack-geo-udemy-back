// file system
const fs = require("fs");
const path = require("path");

const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");

const placesRoutes = require("./routes/places-routes");
const usersRoutes = require("./routes/users-routes");
const HttpError = require("./models/http-error");

const app = express();

app.use(bodyParser.json());

// 이미지 url 요청이 들어올 경우 서버 내 경로에 접근할 수 있게 직접 설정해줘야함.
// staitc을 통해 파일을 그대로 반환하도록 해주자.
// uploads와 images를 합친 경로를 사용할 수 있도록 설정.
app.use("/uploads/images", express.static(path.join("uploads", "images")));

// CORS 해결
app.use((req, res, next) => {
  // 두 번째 인자는 허용 도메인
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");

  next();
});

app.use("/api/places", placesRoutes);
app.use("/api/users", usersRoutes);

// 응답을 보내지 않는 통신에 대해서 에러 처리
// 즉, 지원하지 않는 경로에 통신이 왔을 때 처리하는 것
app.use((req, res, next) => {
  const error = new HttpError("Could not find this route.", 404);
  throw error;
});

// 경로 설정이 없으면 express가 모든 요청에 대해 처리하게 된다
// 따라서, 위에서 작성된 라우터에서 에러가 발생하면 여기서 에러 처리를 한다.
app.use((error, req, res, next) => {
  // 이미지 업로드가 미들웨어를 통해 진행되기 때문에 signup 도중 에러 발생 시 uploads/images에서 손수 지워줘야한다.
  // 이를 자동적으로 하기 위해 핸들링을 작성하자.
  if (req.file) {
    fs.unlink(req.file.path, (err) => {
      console.log(err);
    });
  }

  // 요청이 이미 전송되었는지 확인한다.
  if (res.headerSent) {
    // 이미 응답이 전송된 상태이므로 응답을 전송하지 않도록 설정한다.
    return next(error);
  }

  res.status(error.code || 500);
  res.json({ message: error.message || "An unknown error occured!" });
});

mongoose
  .connect(
    `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.aarlam6.mongodb.net/${process.env.DB_NAME}?retryWrites=true&w=majority`
  )
  .then(() => {
    console.log("Connect Success!");
    app.listen(5000);
  })
  .catch((err) => {
    console.log("Connect Fail...", err);
  });
