import { createContext, useContext } from "react";

export interface GuestContextValue {
  isGuest: boolean;
}

export const GuestContext = createContext<GuestContextValue>({ isGuest: false });

export function useGuest() {
  return useContext(GuestContext);
}
