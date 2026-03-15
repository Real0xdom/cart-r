import {
  TextInput,
  View,
  Text,
  Image,
} from "react-native";

import { InputFieldProps } from "@/types/type";

const InputField = ({
  label,
  icon,
  secureTextEntry = false,
  labelStyle,
  containerStyle,
  inputStyle,
  iconStyle,
  className,
  error = false,
  errorMessage,
  ...props
}: InputFieldProps) => {
 return (
    <View className={`my-2 w-full ${containerStyle || ''}`}>
      <Text className={`text-lg font-JakartaSemiBold mb-3 ${labelStyle || ''}`}>
        {label}
      </Text>
      <View
        className={`flex flex-row justify-start items-center relative bg-neutral-100 rounded-full border ${
          error ? 'border-red-500' : 'border-neutral-100 focus:border-primary-500'
        }`}
      >
        {icon && (
          <Image source={icon} className={`w-6 h-6 ml-4 ${iconStyle || ''}`} />
        )}
        <TextInput
          className={`rounded-full p-4 font-JakartaSemiBold text-[15px] flex-1 ${inputStyle || ''} text-left ${
            error ? 'text-red-600' : ''
          }`}
         secureTextEntry={secureTextEntry}
          {...props}
        />
      </View>
      {error && errorMessage && (
        <Text className="text-red-500 text-xs mt-1 ml-2">{errorMessage}</Text>
      )}
    </View>
  );
};

export default InputField;
