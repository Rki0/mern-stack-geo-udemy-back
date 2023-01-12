const fs = require("fs");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const HttpError = require("../models/http-error");
const getCoordsForAddress = require("../util/location");
const Place = require("../models/place");
const User = require("../models/user");

const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;

  // findById()는 정적 메서드
  // 검색에도 시간이 거릴 수 있으므로 awiat 처리
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not find a place",
      500
    );

    return next(error);
  }

  // get 메서드로 받아온 데이터가 비어있는 경우
  // 에러 처리를 위해 throw를 사용하는 경우 - 라우터가 동기적으로 작동할 때 사용
  if (!place) {
    const error = new HttpError(
      "Could not find a place for the provided placeId.",
      404
    );

    return next(error);
  }

  // getter를 통해 _id로 저장되어있는 것을 id로 사용할 수 있게 만들어준다.
  res.json({ place: place.toObject({ getters: true }) });
};

const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  let userWithPlaces;
  try {
    userWithPlaces = await User.findById(userId).populate("places");
  } catch (err) {
    const error = new HttpError(
      "Fetching places failed, please try again later",
      500
    );

    return next(error);
  }

  // 에러 처리를 위해 next를 사용하는 경우 - 라우터가 비동기적으로 작동할 때 사용
  if (!userWithPlaces || userWithPlaces.places.length === 0) {
    return next(
      new HttpError("Could not find a places for the provided userId.", 404)
    );
  }

  res.json({
    places: userWithPlaces.places.map((place) =>
      place.toObject({ getters: true })
    ),
  });
};

const createPlace = async (req, res, next) => {
  // 검증 후 에러가 있다면 errors 객체를 반환한다.
  const errors = validationResult(req);

  // errrors 객체가 비어있지 않다면 에러가 있는 것
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data", 422)
    );
  }

  const { title, description, address } = req.body;

  let coordinates;

  try {
    coordinates = await getCoordsForAddress(address);
  } catch (error) {
    return next(error);
  }

  const createdPlace = new Place({
    title,
    description,
    address,
    location: coordinates,
    image: req.file.path,
    creator: req.userData.userId,
  });

  let user;

  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    const error = new HttpError(
      "Creating place failed, please try again.",
      500
    );

    return next(error);
  }

  if (!user) {
    const error = new HttpError("Could not find user for provided id", 404);

    return next(error);
  }

  try {
    // 데이터 Id를 저장하는 것과 유저 데이터에 해당 데이터 id를 연결하는 것이 모두 성공해야지만 유효한 데이터가 될 수 있다.
    // session의 transaction을 사용하여 모든 조건이 성공했을 때만 데이터가 변경되도록 만들자.
    // transaction의 경우에는 컬렉션이 존재하지않는 경우 자동 생성하고 데이터를 저장하는게 아니라서, 컬렉션을 만들어놓고 수행해줘야한다.(수동 설정 ㅇㅇ)
    const sess = await mongoose.startSession();
    sess.startTransaction();

    await createdPlace.save({ session: sess });

    // 여기서의 push는 js api가 아니라 mongoose에서 제공하는 것으로, 참조하는 두 개의 모델을 연결할 수 있게 해준다.
    // user 모델의 places 속성에 createdPlace를 넣는다.
    user.places.push(createdPlace);

    await user.save({ session: sess });

    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Creating place failed, please try again.",
      500
    );

    return next(error);
  }

  // 새로 등록하는 api 통신 성공은 201이 관례
  res.status(201).json({ place: createdPlace });
};

const updatePlaceById = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(
      new HttpError("Invalid inputs passed, please check your data", 422)
    );
  }

  const { title, description } = req.body;

  const placeId = req.params.pid;

  let place;

  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not update place.",
      500
    );

    return next(error);
  }

  if (place.creator.toString() !== req.userData.userId) {
    const error = new HttpError("You are not allowed to edit this place.", 401);

    return next(error);
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not update place.",
      500
    );

    return next(error);
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

const deletePlaceById = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;

  try {
    // user 모델에 연결되어 있는 데이터이므로 places 컬렉션에서 삭제하면 user 컬렉션 내에서도 그 데이터를 지워줘야함.
    // 이 때, populate()를 사용한다. 이는 각 모델 스키마에서 ref로 서로를 참조한 경우에만 사용할 수 있다.
    // creator 속성에 user 데이터의 ObjectId를 넣어놨는데, 그를 활용하여 해당 user 데이터를 사용할 수 있음.
    place = await Place.findById(placeId).populate("creator");
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not delete place.",
      500
    );

    return next(error);
  }

  if (!place) {
    const error = new HttpError("Could not find place for this id.", 404);

    return next(error);
  }

  if (place.creator.id !== req.userData.userId) {
    const error = new HttpError(
      "You are not allowed to delete this place.",
      // 403 : 접근 권한이 없다. 인증되지 않은 상태
      // 401 : 인증은 마쳤으나, 작업 실행 권한이 없는 경우.
      401
    );

    return next(error);
  }

  const imagePath = place.image;

  try {
    const sess = await mongoose.startSession();

    sess.startTransaction();

    await place.remove({ session: sess });

    // pull은 자동으로 id를 제거한다.
    // creator에 pull을 적용할 수 있는 것은 앞서 populate()를 사용해 creator로 user 데이터를 사용할 수 있게 해줬기 때문이다.
    place.creator.places.pull(place);

    await place.creator.save({ session: sess });

    await sess.commitTransaction();
  } catch (err) {
    const error = new HttpError(
      "Something went wrong, could not delete place.",
      500
    );

    return next(error);
  }

  fs.unlink(imagePath, (err) => {
    console.log(err);
  });

  res.status(200).json({
    message: "Deleted place",
  });
};

// 여러 개의 컨트롤러를 export 해야한다면 module.exports 대신 exports.아무이름 = 해당_컨트롤러 로 사용
exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlaceById = updatePlaceById;
exports.deletePlaceById = deletePlaceById;
