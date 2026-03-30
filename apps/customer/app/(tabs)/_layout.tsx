import { Tabs } from "expo-router";
import { Image, ImageSourcePropType, View } from "react-native";
import { useLanguage } from "@/contexts/LanguageContext";
import { icons } from "@/constants";
import { Ionicons } from "@expo/vector-icons";

const TabIcon = ({
    source,
    focused,
}: {
    source: ImageSourcePropType;
    focused: boolean;
}) => (
    <View
        className={`flex flex-row justify-center items-center rounded-full ${focused ? "bg-general-300" : ""}`}
    >
        <View
            className={`rounded-full w-12 h-12 items-center justify-center ${focused ? "bg-primary-500" : ""}`}
        >
            <Image
                source={source}
                tintColor="white"
                resizeMode="contain"
                className="w-7 h-7"
            />
        </View>
    </View>
);

const TabIonicons = ({
    name,
    focused,
}: {
    name: keyof typeof Ionicons.glyphMap;
    focused: boolean;
}) => (
    <View
        className={`flex flex-row justify-center items-center rounded-full ${focused ? "bg-general-300" : ""}`}
    >
        <View
            className={`rounded-full w-12 h-12 items-center justify-center ${focused ? "bg-primary-500" : ""}`}
        >
            <Ionicons
                name={name}
                size={24}
                color="white"
            />
        </View>
    </View>
);

const Layout = () => {
    const { t } = useLanguage();
    return (
        <Tabs
            initialRouteName="home"
            screenOptions={{
                tabBarActiveTintColor: "white",
                tabBarInactiveTintColor: "white",
                tabBarShowLabel: false,
                tabBarItemStyle: {
                    flex: 1,
                },
                tabBarIconStyle: {
                    width: "100%",
                    alignItems: "center",
                    justifyContent: "center",
                },
                tabBarStyle: {
                    backgroundColor: "#333333",
                    borderRadius: 50,
                    paddingBottom: 0, // ios only
                    overflow: "hidden",
                    marginHorizontal: 20,
                    marginBottom: 20,
                    height: 78,
                    position: "absolute",
                },
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: t("home"),
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <TabIcon source={icons.home} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="rides"
                options={{
                    title: t("rides"),
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <TabIcon source={icons.list} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="payment"
                options={{
                    title: t("payment"),
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <TabIonicons name="wallet" focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: t("profile"),
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <TabIonicons name="person" focused={focused} />
                    ),
                }}
            />
        </Tabs>
    );
};

export default Layout;
