const jwt = require("jsonwebtoken");

const HttpError = require("../models/http-error");

module.exports = (req, res, next) => {
  if (req.method === "OPTIONS") {
    return next();
  }

  try {
    // Authorization : 'Bearer TOKEN' 이런 식으로 들어가 있기 때문
    const token = req.headers.authorization.split(" ")[1];

    // 토큰이 없는 경우
    if (!token) {
      throw new Error("Authentication failed!");
    }

    // 토큰 유효한지 검사
    // 토큰을 해독하면 토큰 생성 시 포함했던 데이터인 유저 id와 이메일 정보를 포함한 객체를 얻게된다.
    const decodedToken = jwt.verify(token, process.env.JWT_KEY);

    // 동적으로 req에 데이터 추가할 수 있다.
    // 따라서, 이 미들웨어를 거친 라우터에서는 req.userData를 통해 userId에 접근할 수 있다.
    req.userData = { userId: decodedToken.userId };
    next();
  } catch (err) {
    const error = new HttpError("Authentication failed!", 403);

    return next(error);
  }
};
