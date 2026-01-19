"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
const constants_1 = require("@/constants");
const utils_1 = require("@/lib/utils");
const DriverCard = ({ item, selected, setSelected }) => {
    return (<react_native_1.TouchableOpacity onPress={setSelected} className={`${selected === item.id ? "bg-general-600" : "bg-white"} flex flex-row items-center justify-between py-5 px-3 rounded-xl`}>
      <react_native_1.Image source={{ uri: item.profile_image_url }} className="w-14 h-14 rounded-full"/>

      <react_native_1.View className="flex-1 flex flex-col items-start justify-center mx-3">
        <react_native_1.View className="flex flex-row items-center justify-start mb-1">
          <react_native_1.Text className="text-lg font-JakartaRegular">{item.title}</react_native_1.Text>

          <react_native_1.View className="flex flex-row items-center space-x-1 ml-2">
            <react_native_1.Image source={constants_1.icons.star} className="w-3.5 h-3.5"/>
            <react_native_1.Text className="text-sm font-JakartaRegular">4</react_native_1.Text>
          </react_native_1.View>
        </react_native_1.View>

        <react_native_1.View className="flex flex-row items-center justify-start">
          <react_native_1.View className="flex flex-row items-center">
            <react_native_1.Image source={constants_1.icons.dollar} className="w-4 h-4"/>
            <react_native_1.Text className="text-sm font-JakartaRegular ml-1">
              ${item.price}
            </react_native_1.Text>
          </react_native_1.View>

          <react_native_1.Text className="text-sm font-JakartaRegular text-general-800 mx-1">
            |
          </react_native_1.Text>

          <react_native_1.Text className="text-sm font-JakartaRegular text-general-800">
            {(0, utils_1.formatTime)(item.time)}
          </react_native_1.Text>

          <react_native_1.Text className="text-sm font-JakartaRegular text-general-800 mx-1">
            |
          </react_native_1.Text>

          <react_native_1.Text className="text-sm font-JakartaRegular text-general-800">
            {item.car_seats} seats
          </react_native_1.Text>
        </react_native_1.View>
      </react_native_1.View>

      <react_native_1.Image source={{ uri: item.car_image_url }} className="h-14 w-14" resizeMode="contain"/>
    </react_native_1.TouchableOpacity>);
};
exports.default = DriverCard;
