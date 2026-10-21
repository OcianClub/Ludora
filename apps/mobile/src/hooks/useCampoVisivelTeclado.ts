import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Keyboard, type ScrollView, type TextInput } from 'react-native';

export function useCampoVisivelTeclado(scroll: RefObject<ScrollView | null>) {
  const campoFocado = useRef<TextInput | null>(null);
  const quadro = useRef<number | null>(null);
  const [tecladoVisivel, setTecladoVisivel] = useState(() => Keyboard.isVisible());

  const cancelarRolagem = useCallback(() => {
    if (quadro.current !== null) cancelAnimationFrame(quadro.current);
    quadro.current = null;
  }, []);

  const manterCampoVisivel = useCallback(() => {
    cancelarRolagem();
    quadro.current = requestAnimationFrame(() => {
      quadro.current = requestAnimationFrame(() => {
        quadro.current = null;
        const input = campoFocado.current;
        if (!Keyboard.isVisible() || !input?.isFocused()) return;
        scroll.current?.getNativeScrollRef()?.measureInWindow((_x, topo) => {
          if (
            !Keyboard.isVisible() ||
            campoFocado.current !== input ||
            !input.isFocused()
          ) return;
          scroll.current?.scrollResponderScrollNativeHandleToKeyboard(
            input,
            topo + 20,
            true
          );
        });
      });
    });
  }, [cancelarRolagem, scroll]);

  useEffect(() => {
    const mostrar = Keyboard.addListener('keyboardDidShow', () => {
      setTecladoVisivel(true);
      manterCampoVisivel();
    });
    const ajustar = Keyboard.addListener(
      'keyboardDidChangeFrame',
      manterCampoVisivel
    );
    const esconder = Keyboard.addListener('keyboardDidHide', () => {
      setTecladoVisivel(false);
      cancelarRolagem();
    });
    return () => {
      campoFocado.current = null;
      mostrar.remove();
      ajustar.remove();
      esconder.remove();
      cancelarRolagem();
    };
  }, [cancelarRolagem, manterCampoVisivel]);

  const focarCampo = (input: TextInput | null) => {
    campoFocado.current = input;
    manterCampoVisivel();
  };
  const desfocarCampo = (input: TextInput | null) => {
    if (campoFocado.current !== input) return;
    campoFocado.current = null;
    cancelarRolagem();
  };

  return { tecladoVisivel, focarCampo, desfocarCampo, manterCampoVisivel };
}
