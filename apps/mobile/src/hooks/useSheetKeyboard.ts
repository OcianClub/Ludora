import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { findNodeHandle, Keyboard, ScrollView, TextInput } from 'react-native';

/** Scrolls the focused input into view, without retaining a keyboard-height spacer. */
export function useSheetKeyboard(scroll: RefObject<ScrollView | null>) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastNode = useRef<number | null>(null);
  const reveal = useCallback(() => {
    const field = TextInput.State.currentlyFocusedInput();
    const node = field ? findNodeHandle(field as TextInput) : null;
    if (!node || node === lastNode.current) return;
    lastNode.current = node;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (TextInput.State.currentlyFocusedInput() === field) scroll.current?.scrollResponderScrollNativeHandleToKeyboard(node, 24, true);
    }, 280);
  }, [scroll]);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => { lastNode.current = null; reveal(); });
    const hide = Keyboard.addListener('keyboardDidHide', () => { clearTimeout(timer.current); lastNode.current = null; });
    return () => { clearTimeout(timer.current); show.remove(); hide.remove(); };
  }, [reveal]);
  return reveal;
}
