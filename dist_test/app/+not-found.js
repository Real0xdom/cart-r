"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NotFoundScreen;
const expo_router_1 = require("expo-router");
const react_native_1 = require("react-native");
function NotFoundScreen() {
    return (<>
      <expo_router_1.Stack.Screen options={{ title: "Oops!" }}/>
      <react_native_1.View style={styles.container}>
        <react_native_1.Text>This screen doesn't exist.</react_native_1.Text>
        <expo_router_1.Link href="/" style={styles.link}>
          <react_native_1.Text>Go to home screen!</react_native_1.Text>
        </expo_router_1.Link>
      </react_native_1.View>
    </>);
}
const styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    link: {
        marginTop: 15,
        paddingVertical: 15,
    },
});
