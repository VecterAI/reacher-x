"use client";

import type { ChangeEvent } from "react";
import { useCallback, useMemo, useState } from "react";

type UseSliderWithInputProps = {
  minValue?: number;
  maxValue?: number;
  initialValue?: number[];
  defaultValue?: number[];
};

function resolveRange(
  initialValue: number[] | undefined,
  minValue: number,
  maxValue: number
): number[] {
  if (initialValue && initialValue.length >= 2) {
    return [initialValue[0], initialValue[1]];
  }
  if (initialValue && initialValue.length === 1) {
    return [initialValue[0], maxValue];
  }
  return [minValue, maxValue];
}

export function useSliderWithInput({
  minValue = 0,
  maxValue = 100,
  initialValue,
  defaultValue,
}: UseSliderWithInputProps) {
  const resolvedInitial = useMemo(
    () => resolveRange(initialValue, minValue, maxValue),
    [initialValue, minValue, maxValue]
  );
  const resolvedDefault = useMemo(
    () =>
      defaultValue && defaultValue.length >= 2
        ? [defaultValue[0], defaultValue[1]]
        : resolvedInitial,
    [defaultValue, resolvedInitial]
  );

  const [sliderValue, setSliderValue] = useState<number[]>(resolvedInitial);
  const [inputValues, setInputValues] = useState<string[]>(() =>
    resolvedInitial.map((v) => v.toString())
  );

  const showReset =
    sliderValue.length === resolvedDefault.length &&
    !sliderValue.every((value, index) => value === resolvedDefault[index]);

  const validateAndUpdateValue = useCallback(
    (rawValue: string, index: number) => {
      if (rawValue === "" || rawValue === "-") {
        const fallback =
          sliderValue.length > 1
            ? index === 0
              ? minValue
              : maxValue
            : minValue;
        const newSliderValues = [...sliderValue];
        newSliderValues[index] = fallback;
        setSliderValue(newSliderValues);
        const newInputValues = [...inputValues];
        newInputValues[index] = fallback.toString();
        setInputValues(newInputValues);
        return newSliderValues;
      }

      const numValue = Number.parseFloat(rawValue);

      if (Number.isNaN(numValue)) {
        const newInputValues = [...inputValues];
        newInputValues[index] = sliderValue[index]?.toString() ?? "";
        setInputValues(newInputValues);
        return null;
      }

      let clampedValue = Math.min(maxValue, Math.max(minValue, numValue));

      if (sliderValue.length > 1) {
        if (index === 0) {
          clampedValue = Math.min(clampedValue, sliderValue[1] ?? maxValue);
        } else {
          clampedValue = Math.max(clampedValue, sliderValue[0] ?? minValue);
        }
      }

      const newSliderValues = [...sliderValue];
      newSliderValues[index] = clampedValue;
      setSliderValue(newSliderValues);

      const newInputValues = [...inputValues];
      newInputValues[index] = clampedValue.toString();
      setInputValues(newInputValues);
      return newSliderValues;
    },
    [sliderValue, inputValues, minValue, maxValue]
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>, index: number) => {
      const newValue = event.target.value;
      if (newValue === "" || /^-?\d*\.?\d*$/.test(newValue)) {
        const newInputValues = [...inputValues];
        newInputValues[index] = newValue;
        setInputValues(newInputValues);
      }
    },
    [inputValues]
  );

  const handleSliderChange = useCallback((newValue: number[]) => {
    setSliderValue(newValue);
    setInputValues(newValue.map((v) => v.toString()));
    return newValue;
  }, []);

  const resetToDefault = useCallback(() => {
    setSliderValue(resolvedDefault);
    setInputValues(resolvedDefault.map((v) => v.toString()));
  }, [resolvedDefault]);

  return {
    handleInputChange,
    handleSliderChange,
    inputValues,
    resetToDefault,
    showReset,
    sliderValue,
    validateAndUpdateValue,
  };
}
