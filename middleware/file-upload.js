const multer = require("multer");
const { v4: uuidv4 } = require("uuid");

const MIME_TYPE_MAP = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpg",
};

const fileUpload = multer({
  limits: 500000,
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // 첫 번째 인자는 에러
      // 두 번째 인자는 저장 경로
      cb(null, "uploads/images");
    },
    filename: (req, file, cb) => {
      // 확장자를 뜻하는 extension
      const ext = MIME_TYPE_MAP[file.mimetype];

      // 첫 번째 인자는 에러
      // 두 번째 인자는 파일 이름
      cb(null, uuidv4() + "." + ext);
    },
  }),
  fileFilter: (req, file, cb) => {
    // !!는 undefined, null을 false로 바꾸기 위함이다.
    const isValid = !!MIME_TYPE_MAP[file.mimetype];

    let error = isValid ? null : new Error("Invalid mime type!");

    cb(error, isValid);
  },
});

module.exports = fileUpload;
