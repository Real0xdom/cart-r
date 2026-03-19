"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortRides = void 0;
exports.formatTime = formatTime;
exports.formatDate = formatDate;
const sortRides = (rides) => {
    const result = rides.sort((a, b) => {
        const dateA = new Date(`${a.created_at}T${a.ride_time}`);
        const dateB = new Date(`${b.created_at}T${b.ride_time}`);
        return dateB.getTime() - dateA.getTime();
    });
    return result.reverse();
};
exports.sortRides = sortRides;
function formatTime(minutes) {
    const formattedMinutes = +(minutes === null || minutes === void 0 ? void 0 : minutes.toFixed(0)) || 0;
    if (formattedMinutes < 60) {
        return `${minutes} min`;
    }
    else {
        const hours = Math.floor(formattedMinutes / 60);
        const remainingMinutes = formattedMinutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
}
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = date.getDate();
    const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];
    const month = monthNames[date.getMonth()];
    const year = date.getFullYear();
    return `${day < 10 ? "0" + day : day} ${month} ${year}`;
}
