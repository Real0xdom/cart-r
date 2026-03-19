"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const expo_router_1 = require("expo-router");
const react_native_1 = require("react-native");
const constants_1 = require("@/constants");
const TabIcon = ({ source, focused, }) => (<react_native_1.View className={`flex flex-row justify-center items-center rounded-full ${focused ? "bg-general-300" : ""}`}>
        <react_native_1.View className={`rounded-full w-12 h-12 items-center justify-center ${focused ? "bg-primary-500" : ""}`}>
            <react_native_1.Image source={source} tintColor="white" resizeMode="contain" className="w-7 h-7"/>
        </react_native_1.View>
    </react_native_1.View>);
const Layout = () => {
    return (<expo_router_1.Tabs initialRouteName="home" screenOptions={{
            tabBarActiveTintColor: "white",
            tabBarInactiveTintColor: "white",
            tabBarShowLabel: false,
            tabBarStyle: {
                backgroundColor: "#333333",
                borderRadius: 50,
                paddingBottom: 0, // ios only
                overflow: "hidden",
                marginHorizontal: 20,
                marginBottom: 20,
                height: 78,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexDirection: "row",
                position: "absolute",
            },
        }}>
            <expo_router_1.Tabs.Screen name="home" options={{
            title: "Home",
            headerShown: false,
            tabBarIcon: ({ focused }) => (<TabIcon source={constants_1.icons.home} focused={focused}/>),
        }}/>
            <expo_router_1.Tabs.Screen name="rides" options={{
            title: "Rides",
            headerShown: false,
            tabBarIcon: ({ focused }) => (<TabIcon source={constants_1.icons.list} focused={focused}/>),
        }}/>
            <expo_router_1.Tabs.Screen name="chat" options={{
            title: "Chat",
            headerShown: false,
            tabBarIcon: ({ focused }) => (<TabIcon source={constants_1.icons.chat} focused={focused}/>),
        }}/>
            <expo_router_1.Tabs.Screen name="profile" options={{
            title: "Profile",
            headerShown: false,
            tabBarIcon: ({ focused }) => (<TabIcon source={constants_1.icons.profile} focused={focused}/>),
        }}/>
        </expo_router_1.Tabs>);
};
exports.default = Layout;
