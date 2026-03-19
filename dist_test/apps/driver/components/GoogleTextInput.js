"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const react_native_google_places_autocomplete_1 = require("react-native-google-places-autocomplete");
const constants_1 = require("@/constants");
const googlePlacesApiKey = process.env.EXPO_PUBLIC_PLACES_API_KEY;
const GoogleTextInput = ({ icon, initialLocation, containerStyle, textInputBackgroundColor, handlePress, }) => {
    return (<react_native_1.View className={`flex flex-row items-center justify-center relative z-50 rounded-xl ${containerStyle}`}>
      <react_native_google_places_autocomplete_1.GooglePlacesAutocomplete fetchDetails={true} placeholder="Search" debounce={200} styles={{
            textInputContainer: {
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 20,
                marginHorizontal: 20,
                position: "relative",
                shadowColor: "#d4d4d4",
            },
            textInput: {
                backgroundColor: textInputBackgroundColor
                    ? textInputBackgroundColor
                    : "white",
                fontSize: 16,
                fontWeight: "600",
                marginTop: 5,
                width: "100%",
                borderRadius: 200,
            },
            listView: {
                backgroundColor: textInputBackgroundColor
                    ? textInputBackgroundColor
                    : "white",
                position: "relative",
                top: 0,
                width: "100%",
                borderRadius: 10,
                shadowColor: "#d4d4d4",
                zIndex: 99,
            },
        }} onPress={(data, details = null) => {
            handlePress({
                latitude: details === null || details === void 0 ? void 0 : details.geometry.location.lat,
                longitude: details === null || details === void 0 ? void 0 : details.geometry.location.lng,
                address: data.description,
            });
        }} query={{
            key: googlePlacesApiKey,
            language: "en",
        }} renderLeftButton={() => (<react_native_1.View className="justify-center items-center w-6 h-6">
            <react_native_1.Image source={icon ? icon : constants_1.icons.search} className="w-6 h-6" resizeMode="contain"/>
          </react_native_1.View>)} textInputProps={{
            placeholderTextColor: "gray",
            placeholder: initialLocation !== null && initialLocation !== void 0 ? initialLocation : "Where do you want to go?",
        }}/>
    </react_native_1.View>);
};
exports.default = GoogleTextInput;
