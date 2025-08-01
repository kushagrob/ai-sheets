"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

interface UIState {
  isChatPanelOpen: boolean
  chatPanelWidth: number
  activeTheme: "light" | "dark"
  toggleChatPanel: () => void
  setChatPanelWidth: (width: number) => void
  setTheme: (theme: "light" | "dark") => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      isChatPanelOpen: true,
      chatPanelWidth: 384, // Default width (w-96 = 384px)
      activeTheme: "light",
      toggleChatPanel: () => set((state) => ({ isChatPanelOpen: !state.isChatPanelOpen })),
      setChatPanelWidth: (width) => set({ chatPanelWidth: width }),
      setTheme: (theme) => set({ activeTheme: theme }),
    }),
    {
      name: "spreadsheet-ui-state",
      partialize: (state) => ({
        isChatPanelOpen: state.isChatPanelOpen,
        chatPanelWidth: state.chatPanelWidth,
        activeTheme: state.activeTheme,
      }),
    },
  ),
)
