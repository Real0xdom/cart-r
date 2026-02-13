import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { submitRating, RatingData } from '@/lib/ratingUtils';

interface RatingModalProps {
  visible: boolean;
  bookingId: string;
  driverName: string;
  driverId: string;
  customerId: string;
  onClose: () => void;
  onSubmit: () => void;
}

/**
 * Rating Modal Component
 * Allows customers to rate drivers after ride completion
 */
export const RatingModal: React.FC<RatingModalProps> = ({
  visible,
  bookingId,
  driverName,
  driverId,
  customerId,
  onClose,
  onSubmit,
}) => {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      Alert.alert('Rating Required', 'Please select a star rating before submitting.');
      return;
    }

    setIsSubmitting(true);

    const ratingData: RatingData = {
      booking_id: bookingId,
      rating,
      review: review.trim() || undefined,
      rated_by: customerId,
      rated_user: driverId,
      rater_type: 'customer',
    };

    const { success, error } = await submitRating(ratingData);

    setIsSubmitting(false);

    if (success) {
      Alert.alert('Thank You!', 'Your rating has been submitted successfully.');
      resetForm();
      onSubmit();
    } else {
      Alert.alert('Error', error || 'Failed to submit rating. Please try again.');
    }
  };

  const resetForm = () => {
    setRating(0);
    setReview('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl p-6 pb-8">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-JakartaBold text-gray-900">
              Rate Your Driver
            </Text>
            <TouchableOpacity onPress={handleClose} className="p-2">
              <Feather name="x" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          {/* Driver Name */}
          <View className="bg-gray-50 rounded-xl p-4 mb-6 flex-row items-center">
            <View className="w-12 h-12 bg-brand-100 rounded-full items-center justify-center mr-3">
              <Feather name="user" size={24} color="#FF9800" />
            </View>
            <View>
              <Text className="text-sm text-gray-500 font-JakartaMedium">Driver</Text>
              <Text className="text-base font-JakartaBold text-gray-900">{driverName}</Text>
            </View>
          </View>

          {/* Star Rating */}
          <View className="mb-6">
            <Text className="text-sm text-gray-700 font-JakartaSemiBold mb-3">
              How was your experience?
            </Text>
            <View className="flex-row justify-center space-x-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  className="p-2"
                >
                  <Feather
                    name={rating >= star ? 'star' : 'star'}
                    size={40}
                    color={rating >= star ? '#FF9800' : '#e0e0e0'}
                    fill={rating >= star ? '#FF9800' : 'transparent'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            {rating > 0 && (
              <Text className="text-center text-sm text-gray-500 font-JakartaMedium mt-2">
                {rating === 5 ? 'Excellent!' : rating === 4 ? 'Good' : rating === 3 ? 'Average' : rating === 2 ? 'Below Average' : 'Poor'}
              </Text>
            )}
          </View>

          {/* Review Text */}
          <View className="mb-6">
            <Text className="text-sm text-gray-700 font-JakartaSemiBold mb-2">
              Add a review (optional)
            </Text>
            <TextInput
              value={review}
              onChangeText={setReview}
              placeholder="Share your experience..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              maxLength={250}
              className="bg-gray-50 rounded-xl p-4 text-gray-900 font-JakartaMedium"
              style={{ textAlignVertical: 'top', minHeight: 80 }}
            />
            <Text className="text-xs text-gray-400 font-JakartaMedium mt-1 text-right">
              {review.length}/250
            </Text>
          </View>

          {/* Buttons */}
          <View className="flex-row space-x-3">
            <TouchableOpacity
              onPress={handleClose}
              className="flex-1 bg-gray-100 py-4 rounded-xl items-center"
            >
              <Text className="text-gray-700 font-JakartaBold">Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isSubmitting || rating === 0}
              className={`flex-1 py-4 rounded-xl items-center ${
                isSubmitting || rating === 0 ? 'bg-gray-300' : 'bg-brand-500'
              }`}
            >
              <Text className="text-white font-JakartaBold">
                {isSubmitting ? 'Submitting...' : 'Submit Rating'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default RatingModal;
