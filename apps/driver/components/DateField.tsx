import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useState } from "react";
import Modal from "react-native-modal";

import { DateFieldProps } from "@/types/type";

const DateField = ({
 label,
 value,
 onChange,
 placeholder = "Select a date",
 icon,
 labelStyle,
 containerStyle,
 inputStyle,
 iconStyle,
 minimumDate,
 maximumDate,
 error = false,
}: DateFieldProps) => {
 const [showPicker, setShowPicker] = useState(false);
 const [draftDate, setDraftDate] = useState<Date>(value || new Date());

const formatDate = (date: Date | null) => {
   if (!date) return "";
   return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() +1).toString().padStart(2, '0')}/${date.getFullYear()}`;
 };

 const clampDate = (date: Date) => {
   const normalized = new Date(date);
   normalized.setHours(0, 0, 0, 0);

   if (minimumDate) {
     const min = new Date(minimumDate);
     min.setHours(0, 0, 0, 0);
     if (normalized < min) {
       return min;
     }
   }

   if (maximumDate) {
     const max = new Date(maximumDate);
     max.setHours(0, 0, 0, 0);
     if (normalized > max) {
       return max;
     }
   }

   return normalized;
 };

 const getDaysInMonth = (year: number, month: number) =>
   new Date(year, month + 1, 0).getDate();

 const buildDate = (year: number, month: number, day: number) => {
   const safeDay = Math.min(day, getDaysInMonth(year, month));
   return clampDate(new Date(year, month, safeDay));
 };

 const openPicker = () => {
   setDraftDate(clampDate(value || new Date()));
   setShowPicker(true);
 };

 const applyDate = () => {
   onChange(clampDate(draftDate));
   setShowPicker(false);
 };

 const minYear = minimumDate ? minimumDate.getFullYear() : new Date().getFullYear() - 20;
 const maxYear = maximumDate ? maximumDate.getFullYear() : new Date().getFullYear() + 20;
 const years = Array.from({ length: maxYear - minYear + 1 }, (_, index) => minYear + index);
 const months = [
   "Jan",
   "Feb",
   "Mar",
   "Apr",
   "May",
   "Jun",
   "Jul",
   "Aug",
   "Sep",
   "Oct",
   "Nov",
   "Dec",
 ];
 const days = Array.from(
   { length: getDaysInMonth(draftDate.getFullYear(), draftDate.getMonth()) },
   (_, index) => index + 1
 );

 const updateDraftDate = (
   part: "day" | "month" | "year",
   selectedValue: number
 ) => {
   const nextYear = part === "year" ? selectedValue : draftDate.getFullYear();
   const nextMonth = part === "month" ? selectedValue : draftDate.getMonth();
   const nextDay = part === "day" ? selectedValue : draftDate.getDate();

   setDraftDate(buildDate(nextYear, nextMonth, nextDay));
 };

 return (
    <View className={`my-2 w-full ${containerStyle || ''}`}>
      <Text className={`text-lg font-JakartaSemiBold mb-3 ${labelStyle || ''}`}>
        {label}
      </Text>
      <TouchableOpacity
       onPress={openPicker}
       className={`flex flex-row justify-start items-center relative bg-neutral-100 rounded-full border p-4 ${
         error ? 'border-red-500' : 'border-neutral-100'
       }`}
     >
       {icon && (
         <Image source={icon} className={`w-6 h-6 mr-4 ${iconStyle || ''}`} />
       )}
       <Text
       className={`font-JakartaSemiBold text-[15px] flex-1 ${inputStyle || ''} ${
         value ? 'text-black' : 'text-gray-400'
       } ${error ? 'text-red-600' : ''}`}
     >
       {value ? formatDate(value) : placeholder}
     </Text>
   </TouchableOpacity>

   <Modal
     isVisible={showPicker}
     onBackdropPress={() => setShowPicker(false)}
     onBackButtonPress={() => setShowPicker(false)}
     animationIn="fadeIn"
     animationOut="fadeOut"
     backdropOpacity={0.5}
   >
     <View className="rounded-3xl bg-white p-5">
       <Text className="mb-1 text-xl font-JakartaBold">{label}</Text>
       <Text className="mb-4 text-sm text-gray-500">
         Select the date and tap Done.
       </Text>

       <View className="flex-row gap-3">
         <View className="flex-1">
           <Text className="mb-2 text-center font-JakartaSemiBold text-gray-700">
             Day
           </Text>
           <ScrollView className="max-h-56 rounded-2xl bg-neutral-100 p-2">
             {days.map((day) => (
               <TouchableOpacity
                 key={day}
                 onPress={() => updateDraftDate("day", day)}
                 className={`mb-2 rounded-xl px-3 py-3 ${
                   draftDate.getDate() === day ? "bg-green-500" : "bg-white"
                 }`}
               >
                 <Text
                   className={`text-center font-JakartaSemiBold ${
                     draftDate.getDate() === day ? "text-white" : "text-gray-800"
                   }`}
                 >
                   {day}
                 </Text>
               </TouchableOpacity>
             ))}
           </ScrollView>
         </View>

         <View className="flex-1">
           <Text className="mb-2 text-center font-JakartaSemiBold text-gray-700">
             Month
           </Text>
           <ScrollView className="max-h-56 rounded-2xl bg-neutral-100 p-2">
             {months.map((month, index) => (
               <TouchableOpacity
                 key={month}
                 onPress={() => updateDraftDate("month", index)}
                 className={`mb-2 rounded-xl px-3 py-3 ${
                   draftDate.getMonth() === index ? "bg-green-500" : "bg-white"
                 }`}
               >
                 <Text
                   className={`text-center font-JakartaSemiBold ${
                     draftDate.getMonth() === index ? "text-white" : "text-gray-800"
                   }`}
                 >
                   {month}
                 </Text>
               </TouchableOpacity>
             ))}
           </ScrollView>
         </View>

         <View className="flex-1">
           <Text className="mb-2 text-center font-JakartaSemiBold text-gray-700">
             Year
           </Text>
           <ScrollView className="max-h-56 rounded-2xl bg-neutral-100 p-2">
             {years.map((year) => (
               <TouchableOpacity
                 key={year}
                 onPress={() => updateDraftDate("year", year)}
                 className={`mb-2 rounded-xl px-3 py-3 ${
                   draftDate.getFullYear() === year ? "bg-green-500" : "bg-white"
                 }`}
               >
                 <Text
                   className={`text-center font-JakartaSemiBold ${
                     draftDate.getFullYear() === year ? "text-white" : "text-gray-800"
                   }`}
                 >
                   {year}
                 </Text>
               </TouchableOpacity>
             ))}
           </ScrollView>
         </View>
       </View>

       <View className="mt-4 flex-row">
         <TouchableOpacity
           className="mr-2 flex-1 items-center rounded-2xl bg-gray-100 p-4"
           onPress={() => setShowPicker(false)}
         >
           <Text className="font-JakartaSemiBold text-gray-800">Cancel</Text>
         </TouchableOpacity>
         <TouchableOpacity
           className="ml-2 flex-1 items-center rounded-2xl bg-green-500 p-4"
           onPress={applyDate}
         >
           <Text className="font-JakartaSemiBold text-white">Done</Text>
         </TouchableOpacity>
       </View>
     </View>
   </Modal>
 </View>
 );
};

export default DateField;
