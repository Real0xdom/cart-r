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
        className={`flex flex-row justify-center items-center rounded-full ${focused ? "bg-green-100" : ""}`}
    >
        <View
            className={`rounded-full w-12 h-12 items-center justify-center ${focused ? "bg-green-500" : ""}`}
        >
            <Image
                source={source}
                tintColor={focused ? "white" : "#6b7280"}
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
        className={`flex flex-row justify-center items-center rounded-full ${focused ? "bg-green-100" : ""}`}
    >
        <View
            className={`rounded-full w-12 h-12 items-center justify-center ${focused ? "bg-green-500" : ""}`}
        >
            <Ionicons
                name={name}
                size={24}
                color={focused ? "white" : "#6b7280"}
            />
        </View>
    </View>
);

const DriverTabsLayout = () => {
    const { t } = useLanguage();
    return (
        <Tabs
            initialRouteName="home"
            screenOptions={{
                tabBarActiveTintColor: "#22c55e",
                tabBarInactiveTintColor: "#6b7280",
                tabBarShowLabel: false,
                tabBarStyle: {
                    backgroundColor: "#ffffff",
                    borderRadius: 50,
                    paddingBottom: 0,
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
                name="requests"
                options={{
                    title: t("myRides") || "My Rides",
                    headerShown: false,
                    tabBarIcon: ({ focused }) => (
                        <TabIcon source={icons.list} focused={focused} />
                    ),
                }}
            />
            <Tabs.Screen
                name="earnings"
                options={{
                    title: t("earnings"),
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

export default DriverTabsLayout;
