import { createContext, useContext, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
export type HeaderAction = { label: string; disabled: boolean; run: () => void };
export type LeaveHandler = (action: () => void) => void;
export const PageActions = createContext<{ setSave: Dispatch<SetStateAction<HeaderAction | null>>; leave: MutableRefObject<LeaveHandler | null> } | null>(null);
export const usePageActions = () => useContext(PageActions);
