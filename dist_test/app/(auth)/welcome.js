"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_1 = require("react");
const react_native_1 = require("react-native");
const react_native_safe_area_context_1 = require("react-native-safe-area-context");
const react_native_swiper_1 = __importDefault(require("react-native-swiper"));
const CustomButton_1 = __importDefault(require("@/components/CustomButton"));
const constants_1 = require("@/constants");
const Welcome = () => {
    const swiperRef = (0, react_1.useRef)(null);
    const [activeIndex, setActiveIndex] = (0, react_1.useState)(0);
    const [showRoleSelection, setShowRoleSelection] = (0, react_1.useState)(false);
    const isLastSlide = activeIndex === constants_1.onboarding.length - 1;
    if (showRoleSelection) {
        return (<react_native_safe_area_context_1.SafeAreaView className="flex-1 bg-white items-center justify-center p-5">
        <react_native_1.Text className="text-3xl font-JakartaBold text-center mb-3">
          Welcome to Carter
        </react_native_1.Text>
        <react_native_1.Text className="text-lg text-gray-500 text-center mb-10">
          Pune's trusted logistics partner
        </react_native_1.Text>

        <react_native_1.View className="w-full gap-4">
          <CustomButton_1.default title="I need to ship something" onPress={() => expo_router_1.router.push("/(customer)/sign-in")} className="bg-primary-500"/>
          <CustomButton_1.default title="I'm a driver" onPress={() => expo_router_1.router.push("/(driver)/sign-in")} bgVariant="outline" textVariant="primary"/>
        </react_native_1.View>

        <react_native_1.TouchableOpacity onPress={() => setShowRoleSelection(false)} className="mt-10">
          <react_native_1.Text className="text-gray-400">Back to intro</react_native_1.Text>
        </react_native_1.TouchableOpacity>
      </react_native_safe_area_context_1.SafeAreaView>);
    }
    return (<react_native_safe_area_context_1.SafeAreaView className="flex h-full items-center justify-between bg-white">
      <react_native_1.TouchableOpacity onPress={() => setShowRoleSelection(true)} className="w-full flex justify-end items-end p-5">
        <react_native_1.Text className="text-black text-md font-JakartaBold">Skip</react_native_1.Text>
      </react_native_1.TouchableOpacity>

      <react_native_swiper_1.default ref={swiperRef} loop={false} dot={<react_native_1.View className="w-[32px] h-[4px] mx-1 bg-[#E2E8F0] rounded-full"/>} activeDot={<react_native_1.View className="w-[32px] h-[4px] mx-1 bg-[#0286FF] rounded-full"/>} onIndexChanged={(index) => setActiveIndex(index)}>
        {constants_1.onboarding.map((item) => (<react_native_1.View key={item.id} className="flex items-center justify-center p-5">
            <react_native_1.Image source={item.image} className="w-full h-[300px]" resizeMode="contain"/>
            <react_native_1.View className="flex flex-row items-center justify-center w-full mt-10">
              <react_native_1.Text className="text-black text-3xl font-bold mx-10 text-center">
                {item.title}
              </react_native_1.Text>
            </react_native_1.View>
            <react_native_1.Text className="text-md font-JakartaSemiBold text-center text-[#858585] mx-10 mt-3">
              {item.description}
            </react_native_1.Text>
          </react_native_1.View>))}
      </react_native_swiper_1.default>

      <CustomButton_1.default title={isLastSlide ? "Get Started" : "Next"} onPress={() => {
            var _a;
            return isLastSlide
                ? setShowRoleSelection(true)
                : (_a = swiperRef.current) === null || _a === void 0 ? void 0 : _a.scrollBy(1);
        }} className="w-11/12 mt-10 mb-5"/>
    </react_native_safe_area_context_1.SafeAreaView>);
};
exports.default = Welcome;
