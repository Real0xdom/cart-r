import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export type OtpCodeFieldHandle = {
  focus: () => void;
  blur: () => void;
};

type OtpCodeFieldProps = {
  value: string;
  onChange: (value: string) => void;
  length: number;
  error?: boolean;
  autoFocus?: boolean;
  boxWidth?: number;
  boxHeight?: number;
  fontSize?: number;
  gap?: number;
  testID?: string;
};

const OtpCodeField = forwardRef<OtpCodeFieldHandle, OtpCodeFieldProps>(
  (
    {
      value,
      onChange,
      length,
      error = false,
      autoFocus = false,
      boxWidth = 64,
      boxHeight = 64,
      fontSize = 24,
      gap = 12,
      testID,
    },
    ref
  ) => {
    const inputRef = useRef<TextInput>(null);
    const [isFocused, setIsFocused] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        focus: () => inputRef.current?.focus(),
        blur: () => inputRef.current?.blur(),
      }),
      []
    );

    useEffect(() => {
      if (!autoFocus) return;

      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 150);

      return () => clearTimeout(timer);
    }, [autoFocus]);

    const sanitizedValue = value.replace(/\D/g, '').slice(0, length);
    const activeIndex = Math.min(sanitizedValue.length, length - 1);

    const handleChangeText = (text: string) => {
      onChange(text.replace(/\D/g, '').slice(0, length));
    };

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Enter ${length}-digit OTP`}
        onPress={() => inputRef.current?.focus()}
        style={styles.wrapper}
        testID={testID}
      >
        <View style={[styles.boxRow, { columnGap: gap }]}>
          {Array.from({ length }, (_, index) => {
            const digit = sanitizedValue[index] ?? '';
            const isActive = isFocused && activeIndex === index;
            const borderColor = error
              ? '#ef4444'
              : digit
                ? '#22c55e'
                : isActive
                  ? '#22c55e'
                  : '#e5e7eb';

            return (
              <View
                key={index}
                style={[
                  styles.box,
                  {
                    width: boxWidth,
                    height: boxHeight,
                    borderColor,
                    backgroundColor: '#f3f4f6',
                  },
                ]}
              >
                <Text style={[styles.digit, { fontSize }]}>{digit}</Text>
              </View>
            );
          })}
        </View>

        <TextInput
          ref={inputRef}
          value={sanitizedValue}
          onChangeText={handleChangeText}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={length}
          caretHidden
          selectionColor="transparent"
          style={styles.hiddenInput}
        />
      </Pressable>
    );
  }
);

OtpCodeField.displayName = 'OtpCodeField';

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'stretch',
  },
  boxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  box: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 2,
    elevation: 5,
    justifyContent: 'center',
    zIndex: 10,
  },
  digit: {
    color: '#111827',
    fontWeight: '700',
    textAlign: 'center',
  },
  hiddenInput: {
    height: 1,
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
    width: 1,
  },
});

export default OtpCodeField;
