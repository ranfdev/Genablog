import { createContext, useContext } from "solid-js";

export const AppStateContext = createContext();
export default AppStateContext;

export function useAppState() {
  return useContext(AppStateContext);
}
