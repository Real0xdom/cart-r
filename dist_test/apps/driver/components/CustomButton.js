"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const getBgVariantStyle = (variant) => {
    switch (variant) {
        case "secondary":
            return "bg-gray-500";
        case "danger":
            return "bg-red-500";
        case "success":
            return "bg-green-500";
        case "outline":
            return "bg-transparent border-neutral-300 border-[0.5px]";
        default:
            return "bg-[#0286FF]";
    }
};
const getTextVariantStyle = (variant) => {
    switch (variant) {
        case "primary":
            return "text-black";
        case "secondary":
            return "text-gray-100";
        case "danger":
            return "text-red-100";
        case "success":
            return "text-green-100";
        default:
            return "text-white";
    }
};
const CustomButton = ({ onPress, title, bgVariant = "primary", textVariant = "default", IconLeft, IconRight, className, ...props }) => {
    return (<react_native_1.TouchableOpacity onPress={onPress} className={`w-full rounded-full p-3 flex flex-row justify-center items-center shadow-md shadow-neutral-400/70 ${getBgVariantStyle(bgVariant)} ${className}`} {...props}>
      {IconLeft && <IconLeft />}
      <react_native_1.Text className={`text-lg font-bold ${getTextVariantStyle(textVariant)}`}>
        {title}
      </react_native_1.Text>
      {IconRight && <IconRight />}
    </react_native_1.TouchableOpacity>);
};
exports.default = CustomButton;
