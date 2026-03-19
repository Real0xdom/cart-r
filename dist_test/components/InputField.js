"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const InputField = ({ label, icon, secureTextEntry = false, labelStyle, containerStyle, inputStyle, iconStyle, className, ...props }) => {
    return (<react_native_1.KeyboardAvoidingView behavior={react_native_1.Platform.OS === "ios" ? "padding" : "height"}>
      <react_native_1.TouchableWithoutFeedback onPress={react_native_1.Keyboard.dismiss}>
        <react_native_1.View className="my-2 w-full">
          <react_native_1.Text className={`text-lg font-JakartaSemiBold mb-3 ${labelStyle}`}>
            {label}
          </react_native_1.Text>
          <react_native_1.View className={`flex flex-row justify-start items-center relative bg-neutral-100 rounded-full border border-neutral-100 focus:border-primary-500  ${containerStyle}`}>
            {icon && (<react_native_1.Image source={icon} className={`w-6 h-6 ml-4 ${iconStyle}`}/>)}
            <react_native_1.TextInput className={`rounded-full p-4 font-JakartaSemiBold text-[15px] flex-1 ${inputStyle} text-left`} secureTextEntry={secureTextEntry} {...props}/>
          </react_native_1.View>
        </react_native_1.View>
      </react_native_1.TouchableWithoutFeedback>
    </react_native_1.KeyboardAvoidingView>);
};
exports.default = InputField;
