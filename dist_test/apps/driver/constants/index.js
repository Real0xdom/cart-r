"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.data = exports.onboarding = exports.icons = exports.images = void 0;
const arrow_down_png_1 = __importDefault(require("@/assets/icons/arrow-down.png"));
const arrow_up_png_1 = __importDefault(require("@/assets/icons/arrow-up.png"));
const back_arrow_png_1 = __importDefault(require("@/assets/icons/back-arrow.png"));
const chat_png_1 = __importDefault(require("@/assets/icons/chat.png"));
const check_png_1 = __importDefault(require("@/assets/icons/check.png"));
const close_png_1 = __importDefault(require("@/assets/icons/close.png"));
const dollar_png_1 = __importDefault(require("@/assets/icons/dollar.png"));
const email_png_1 = __importDefault(require("@/assets/icons/email.png"));
const eyecross_png_1 = __importDefault(require("@/assets/icons/eyecross.png"));
const google_png_1 = __importDefault(require("@/assets/icons/google.png"));
const home_png_1 = __importDefault(require("@/assets/icons/home.png"));
const list_png_1 = __importDefault(require("@/assets/icons/list.png"));
const lock_png_1 = __importDefault(require("@/assets/icons/lock.png"));
const map_png_1 = __importDefault(require("@/assets/icons/map.png"));
const marker_png_1 = __importDefault(require("@/assets/icons/marker.png"));
const out_png_1 = __importDefault(require("@/assets/icons/out.png"));
const person_png_1 = __importDefault(require("@/assets/icons/person.png"));
const pin_png_1 = __importDefault(require("@/assets/icons/pin.png"));
const point_png_1 = __importDefault(require("@/assets/icons/point.png"));
const profile_png_1 = __importDefault(require("@/assets/icons/profile.png"));
const search_png_1 = __importDefault(require("@/assets/icons/search.png"));
const selected_marker_png_1 = __importDefault(require("@/assets/icons/selected-marker.png"));
const star_png_1 = __importDefault(require("@/assets/icons/star.png"));
const target_png_1 = __importDefault(require("@/assets/icons/target.png"));
const to_png_1 = __importDefault(require("@/assets/icons/to.png"));
const check_png_2 = __importDefault(require("@/assets/images/check.png"));
const get_started_png_1 = __importDefault(require("@/assets/images/get-started.png"));
const message_png_1 = __importDefault(require("@/assets/images/message.png"));
const no_result_png_1 = __importDefault(require("@/assets/images/no-result.png"));
const onboarding1_png_1 = __importDefault(require("@/assets/images/onboarding1.png"));
const onboarding2_png_1 = __importDefault(require("@/assets/images/onboarding2.png"));
const onboarding3_png_1 = __importDefault(require("@/assets/images/onboarding3.png"));
const signup_car_png_1 = __importDefault(require("@/assets/images/signup-car.png"));
exports.images = {
    onboarding1: onboarding1_png_1.default,
    onboarding2: onboarding2_png_1.default,
    onboarding3: onboarding3_png_1.default,
    getStarted: get_started_png_1.default,
    signUpCar: signup_car_png_1.default,
    check: check_png_2.default,
    noResult: no_result_png_1.default,
    message: message_png_1.default,
};
exports.icons = {
    arrowDown: arrow_down_png_1.default,
    arrowUp: arrow_up_png_1.default,
    backArrow: back_arrow_png_1.default,
    chat: chat_png_1.default,
    checkmark: check_png_1.default,
    close: close_png_1.default,
    dollar: dollar_png_1.default,
    email: email_png_1.default,
    eyecross: eyecross_png_1.default,
    google: google_png_1.default,
    home: home_png_1.default,
    list: list_png_1.default,
    lock: lock_png_1.default,
    map: map_png_1.default,
    marker: marker_png_1.default,
    out: out_png_1.default,
    person: person_png_1.default,
    pin: pin_png_1.default,
    point: point_png_1.default,
    profile: profile_png_1.default,
    search: search_png_1.default,
    selectedMarker: selected_marker_png_1.default,
    star: star_png_1.default,
    target: target_png_1.default,
    to: to_png_1.default,
};
exports.onboarding = [
    {
        id: 1,
        title: "The perfect ride is just a tap away!",
        description: "Your journey begins with Ryde. Find your ideal ride effortlessly.",
        image: exports.images.onboarding1,
    },
    {
        id: 2,
        title: "Best car in your hands with Ryde",
        description: "Discover the convenience of finding your perfect ride with Ryde",
        image: exports.images.onboarding2,
    },
    {
        id: 3,
        title: "Your ride, your way. Let's go!",
        description: "Enter your destination, sit back, and let us take care of the rest.",
        image: exports.images.onboarding3,
    },
];
exports.data = {
    onboarding: exports.onboarding,
};
