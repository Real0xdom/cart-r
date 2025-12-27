// Ratings and Reviews Component for Trip Completion
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Animated } from 'react-native';

interface RatingReviewProps {
  driverName: string;
  vehicleNumber: string;
  tripDate: string;
  fare: number;
  onSubmit: (rating: number, review: string, tips?: string[]) => void;
  onSkip?: () => void;
}

const QUICK_TIPS = [
  '👍 Great driver',
  '🚗 Smooth ride',
  '⏱️ On time',
  '🧹 Clean vehicle',
  '💬 Friendly',
  '🗺️ Good navigation',
];

const RatingReview: React.FC<RatingReviewProps> = ({
  driverName,
  vehicleNumber,
  tripDate,
  fare,
  onSubmit,
  onSkip,
}) => {
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [selectedTips, setSelectedTips] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const scaleAnims = useState(
    Array(5).fill(null).map(() => new Animated.Value(1))
  )[0];

  const handleStarPress = (starIndex: number) => {
    setRating(starIndex + 1);
    
    // Animate star
    Animated.sequence([
      Animated.timing(scaleAnims[starIndex], {
        toValue: 1.4,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnims[starIndex], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const toggleTip = (tip: string) => {
    setSelectedTips((prev) =>
      prev.includes(tip)
        ? prev.filter((t) => t !== tip)
        : [...prev, tip]
    );
  };

  const handleSubmit = () => {
    if (rating === 0) return;
    setSubmitted(true);
    onSubmit(rating, review, selectedTips);
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={styles.thankYouContainer}>
          <Text style={styles.thankYouEmoji}>🎉</Text>
          <Text style={styles.thankYouTitle}>Thank You!</Text>
          <Text style={styles.thankYouSubtitle}>
            Your feedback helps improve our service
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Rate Your Trip</Text>
        <Text style={styles.subtitle}>
          How was your ride with {driverName}?
        </Text>
      </View>

      {/* Trip Summary */}
      <View style={styles.tripSummary}>
        <View style={styles.tripRow}>
          <Text style={styles.tripLabel}>Vehicle</Text>
          <Text style={styles.tripValue}>{vehicleNumber}</Text>
        </View>
        <View style={styles.tripRow}>
          <Text style={styles.tripLabel}>Date</Text>
          <Text style={styles.tripValue}>{tripDate}</Text>
        </View>
        <View style={styles.tripRow}>
          <Text style={styles.tripLabel}>Fare</Text>
          <Text style={styles.tripValueHighlight}>₹{fare}</Text>
        </View>
      </View>

      {/* Star Rating */}
      <View style={styles.starsContainer}>
        {[0, 1, 2, 3, 4].map((index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleStarPress(index)}
            activeOpacity={0.7}
          >
            <Animated.Text
              style={[
                styles.star,
                { transform: [{ scale: scaleAnims[index] }] },
              ]}
            >
              {index < rating ? '⭐' : '☆'}
            </Animated.Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.ratingText}>
        {rating === 0 && 'Tap to rate'}
        {rating === 1 && 'Poor'}
        {rating === 2 && 'Fair'}
        {rating === 3 && 'Good'}
        {rating === 4 && 'Great'}
        {rating === 5 && 'Excellent!'}
      </Text>

      {/* Quick Tips */}
      {rating > 0 && (
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsLabel}>What went well?</Text>
          <View style={styles.tipsGrid}>
            {QUICK_TIPS.map((tip) => (
              <TouchableOpacity
                key={tip}
                style={[
                  styles.tipChip,
                  selectedTips.includes(tip) && styles.tipChipSelected,
                ]}
                onPress={() => toggleTip(tip)}
              >
                <Text
                  style={[
                    styles.tipText,
                    selectedTips.includes(tip) && styles.tipTextSelected,
                  ]}
                >
                  {tip}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Review Input */}
      {rating > 0 && (
        <View style={styles.reviewContainer}>
          <TextInput
            style={styles.reviewInput}
            placeholder="Add a comment (optional)"
            placeholderTextColor="#6b7280"
            value={review}
            onChangeText={setReview}
            multiline
            numberOfLines={3}
          />
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={rating === 0}
      >
        <Text style={styles.submitButtonText}>Submit Rating</Text>
      </TouchableOpacity>

      {/* Skip Button */}
      {onSkip && (
        <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  tripSummary: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  tripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  tripLabel: {
    color: '#6b7280',
    fontSize: 14,
  },
  tripValue: {
    color: '#1f2937',
    fontSize: 14,
    fontWeight: '500',
  },
  tripValueHighlight: {
    color: '#22c55e',
    fontSize: 16,
    fontWeight: '700',
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  star: {
    fontSize: 40,
  },
  ratingText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    marginBottom: 20,
  },
  tipsContainer: {
    marginBottom: 20,
  },
  tipsLabel: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  tipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tipChip: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tipChipSelected: {
    backgroundColor: '#dcfce7',
    borderColor: '#22c55e',
  },
  tipText: {
    color: '#4b5563',
    fontSize: 13,
  },
  tipTextSelected: {
    color: '#16a34a',
    fontWeight: '500',
  },
  reviewContainer: {
    marginBottom: 20,
  },
  reviewInput: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    color: '#1f2937',
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipButton: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#6b7280',
    fontSize: 14,
  },
  thankYouContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  thankYouEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  thankYouTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  thankYouSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
});

export default RatingReview;
