"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metadata = void 0;
exports.default = RootLayout;
const google_1 = require("next/font/google");
const react_hot_toast_1 = require("react-hot-toast");
require("./globals.css");
const geistSans = (0, google_1.Geist)({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});
const geistMono = (0, google_1.Geist_Mono)({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});
exports.metadata = {
    title: "CARTR Admin",
    description: "Admin console for CARTR delivery management",
};
function RootLayout({ children, }) {
    return (<html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <react_hot_toast_1.Toaster position="top-right" toastOptions={{
            duration: 4000,
            style: {
                background: '#333',
                color: '#fff',
            },
            success: {
                iconTheme: {
                    primary: '#22c55e',
                    secondary: '#fff',
                },
            },
            error: {
                iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                },
            },
        }}/>
        {children}
      </body>
    </html>);
}
