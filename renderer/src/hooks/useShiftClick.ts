// START OF FILE: renderer/src/hooks/useShiftClick.ts

import { useRef } from 'react';

export function useShiftClick() {
    const pressed = useRef(false);

    function onKeyDown(e: KeyboardEvent) {
        if (e.key === 'Shift') pressed.current = true;
    }
    function onKeyUp(e: KeyboardEvent) {
        if (e.key === 'Shift') pressed.current = false;
    }
    function isShiftPressed() {
        return pressed.current;
    }

    return { onKeyDown, onKeyUp, isShiftPressed };
}

// END OF FILE
