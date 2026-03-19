"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bottom_sheet_1 = __importStar(require("@gorhom/bottom-sheet"));
const expo_router_1 = require("expo-router");
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const react_native_gesture_handler_1 = require("react-native-gesture-handler");
const Map_1 = __importDefault(require("@/components/Map"));
const constants_1 = require("@/constants");
const RideLayout = ({ title, snapPoints, children, }) => {
    const bottomSheetRef = (0, react_1.useRef)(null);
    return (<react_native_gesture_handler_1.GestureHandlerRootView className="flex-1">
      <react_native_1.View className="flex-1 bg-white">
        <react_native_1.View className="flex flex-col h-screen bg-blue-500">
          <react_native_1.View className="flex flex-row absolute z-10 top-16 items-center justify-start px-5">
            <react_native_1.TouchableOpacity onPress={() => expo_router_1.router.back()}>
              <react_native_1.View className="w-10 h-10 bg-white rounded-full items-center justify-center">
                <react_native_1.Image source={constants_1.icons.backArrow} resizeMode="contain" className="w-6 h-6"/>
              </react_native_1.View>
            </react_native_1.TouchableOpacity>
            <react_native_1.Text className="text-xl font-JakartaSemiBold ml-5">
              {title || "Go Back"}
            </react_native_1.Text>
          </react_native_1.View>

          <Map_1.default />
        </react_native_1.View>

        <bottom_sheet_1.default ref={bottomSheetRef} snapPoints={snapPoints || ["40%", "85%"]} index={0}>
          {title === "Choose a Rider" ? (<bottom_sheet_1.BottomSheetView style={{
                flex: 1,
                padding: 20,
            }}>
              {children}
            </bottom_sheet_1.BottomSheetView>) : (<bottom_sheet_1.BottomSheetScrollView style={{
                flex: 1,
                padding: 20,
            }}>
              {children}
            </bottom_sheet_1.BottomSheetScrollView>)}
        </bottom_sheet_1.default>
      </react_native_1.View>
    </react_native_gesture_handler_1.GestureHandlerRootView>);
};
exports.default = RideLayout;
