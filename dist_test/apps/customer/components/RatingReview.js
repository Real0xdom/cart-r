"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// Ratings and Reviews Component for Trip Completion
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const QUICK_TIPS = [
    '👍 Great driver',
    '🚗 Smooth ride',
    '⏱️ On time',
    '🧹 Clean vehicle',
    '💬 Friendly',
    '🗺️ Good navigation',
];
const RatingReview = ({ driverName, vehicleNumber, tripDate, fare, onSubmit, onSkip, }) => {
    const [rating, setRating] = (0, react_1.useState)(0);
    const [review, setReview] = (0, react_1.useState)('');
    const [selectedTips, setSelectedTips] = (0, react_1.useState)([]);
    const [submitted, setSubmitted] = (0, react_1.useState)(false);
    const scaleAnims = (0, react_1.useState)(Array(5).fill(null).map(() => new react_native_1.Animated.Value(1)))[0];
    const handleStarPress = (starIndex) => {
        setRating(starIndex + 1);
        // Animate star
        react_native_1.Animated.sequence([
            react_native_1.Animated.timing(scaleAnims[starIndex], {
                toValue: 1.4,
                duration: 100,
                useNativeDriver: true,
            }),
            react_native_1.Animated.timing(scaleAnims[starIndex], {
                toValue: 1,
                duration: 100,
                useNativeDriver: true,
            }),
        ]).start();
    };
    const toggleTip = (tip) => {
        setSelectedTips((prev) => prev.includes(tip)
            ? prev.filter((t) => t !== tip)
            : [...prev, tip]);
    };
    const handleSubmit = () => {
        if (rating === 0)
            return;
        setSubmitted(true);
        onSubmit(rating, review, selectedTips);
    };
    if (submitted) {
        return (<react_native_1.View style={styles.container}>
        <react_native_1.View style={styles.thankYouContainer}>
          <react_native_1.Text style={styles.thankYouEmoji}>🎉</react_native_1.Text>
          <react_native_1.Text style={styles.thankYouTitle}>Thank You!</react_native_1.Text>
          <react_native_1.Text style={styles.thankYouSubtitle}>
            Your feedback helps improve our service
          </react_native_1.Text>
        </react_native_1.View>
      </react_native_1.View>);
    }
    return (<react_native_1.View style={styles.container}>
      {/* Header */}
      <react_native_1.View style={styles.header}>
        <react_native_1.Text style={styles.title}>Rate Your Trip</react_native_1.Text>
        <react_native_1.Text style={styles.subtitle}>
          How was your ride with {driverName}?
        </react_native_1.Text>
      </react_native_1.View>

      {/* Trip Summary */}
      <react_native_1.View style={styles.tripSummary}>
        <react_native_1.View style={styles.tripRow}>
          <react_native_1.Text style={styles.tripLabel}>Vehicle</react_native_1.Text>
          <react_native_1.Text style={styles.tripValue}>{vehicleNumber}</react_native_1.Text>
        </react_native_1.View>
        <react_native_1.View style={styles.tripRow}>
          <react_native_1.Text style={styles.tripLabel}>Date</react_native_1.Text>
          <react_native_1.Text style={styles.tripValue}>{tripDate}</react_native_1.Text>
        </react_native_1.View>
        <react_native_1.View style={styles.tripRow}>
          <react_native_1.Text style={styles.tripLabel}>Fare</react_native_1.Text>
          <react_native_1.Text style={styles.tripValueHighlight}>₹{fare}</react_native_1.Text>
        </react_native_1.View>
      </react_native_1.View>

      {/* Star Rating */}
      <react_native_1.View style={styles.starsContainer}>
        {[0, 1, 2, 3, 4].map((index) => (<react_native_1.TouchableOpacity key={index} onPress={() => handleStarPress(index)} activeOpacity={0.7}>
            <react_native_1.Animated.Text style={[
                styles.star,
                { transform: [{ scale: scaleAnims[index] }] },
            ]}>
              {index < rating ? '⭐' : '☆'}
            </react_native_1.Animated.Text>
          </react_native_1.TouchableOpacity>))}
      </react_native_1.View>
      <react_native_1.Text style={styles.ratingText}>
        {rating === 0 && 'Tap to rate'}
        {rating === 1 && 'Poor'}
        {rating === 2 && 'Fair'}
        {rating === 3 && 'Good'}
        {rating === 4 && 'Great'}
        {rating === 5 && 'Excellent!'}
      </react_native_1.Text>

      {/* Quick Tips */}
      {rating > 0 && (<react_native_1.View style={styles.tipsContainer}>
          <react_native_1.Text style={styles.tipsLabel}>What went well?</react_native_1.Text>
          <react_native_1.View style={styles.tipsGrid}>
            {QUICK_TIPS.map((tip) => (<react_native_1.TouchableOpacity key={tip} style={[
                    styles.tipChip,
                    selectedTips.includes(tip) && styles.tipChipSelected,
                ]} onPress={() => toggleTip(tip)}>
                <react_native_1.Text style={[
                    styles.tipText,
                    selectedTips.includes(tip) && styles.tipTextSelected,
                ]}>
                  {tip}
                </react_native_1.Text>
              </react_native_1.TouchableOpacity>))}
          </react_native_1.View>
        </react_native_1.View>)}

      {/* Review Input */}
      {rating > 0 && (<react_native_1.View style={styles.reviewContainer}>
          <react_native_1.TextInput style={styles.reviewInput} placeholder="Add a comment (optional)" placeholderTextColor="#6b7280" value={review} onChangeText={setReview} multiline numberOfLines={3}/>
        </react_native_1.View>)}

      {/* Submit Button */}
      <react_native_1.TouchableOpacity style={[styles.submitButton, rating === 0 && styles.submitButtonDisabled]} onPress={handleSubmit} disabled={rating === 0}>
        <react_native_1.Text style={styles.submitButtonText}>Submit Rating</react_native_1.Text>
      </react_native_1.TouchableOpacity>

      {/* Skip Button */}
      {onSkip && (<react_native_1.TouchableOpacity style={styles.skipButton} onPress={onSkip}>
          <react_native_1.Text style={styles.skipButtonText}>Skip for now</react_native_1.Text>
        </react_native_1.TouchableOpacity>)}
    </react_native_1.View>);
};
const styles = react_native_1.StyleSheet.create({
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
exports.default = RatingReview;
