import { create } from "zustand";

type Format = "square" | "portrait" | "landscape" | "story";
export type VideoScene = {
  id: string;
  durationSeconds: number;
  script: string;
  caption: string;
  transition: "fade" | "slide" | "zoom";
  backgroundAssetId?: string;
};
export type ImageTemplate = {
  headline: string;
  brandColor: string;
  fontFamily: string;
  logoPosition: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  logoAssetId?: string;
  safeMargin: number;
};
type EditorState = {
  selectedAssetId?: string;
  format: Format;
  zoom: number;
  activeScene: number;
  scenes: VideoScene[];
  musicUrl: string;
  template: ImageTemplate;
  setAsset(id?: string): void;
  setFormat(format: Format): void;
  setZoom(zoom: number): void;
  setActiveScene(index: number): void;
  addScene(): void;
  updateScene(id: string, patch: Partial<VideoScene>): void;
  removeScene(id: string): void;
  setMusicUrl(url: string): void;
  setTemplate(patch: Partial<ImageTemplate>): void;
};
export const useEditorStore = create<EditorState>((set) => ({
  selectedAssetId: undefined,
  format: "square",
  zoom: 1,
  activeScene: 0,
  musicUrl: "",
  template: {
    headline: "",
    brandColor: "#ff5a36",
    fontFamily: "Inter",
    logoPosition: "top-left",
    safeMargin: 48,
  },
  scenes: [
    {
      id: crypto.randomUUID(),
      durationSeconds: 3,
      script: "Open with a specific customer tension.",
      caption: "A sharper way forward",
      transition: "fade",
    },
  ],
  setAsset: (selectedAssetId) => set({ selectedAssetId }),
  setFormat: (format) => set({ format }),
  setZoom: (zoom) => set({ zoom }),
  setActiveScene: (activeScene) => set({ activeScene }),
  addScene: () =>
    set((state) => ({
      scenes: [
        ...state.scenes,
        {
          id: crypto.randomUUID(),
          durationSeconds: 3,
          script: "Show the product solving the problem.",
          caption: "Designed for real life",
          transition: "slide",
        },
      ],
    })),
  updateScene: (id, patch) =>
    set((state) => ({
      scenes: state.scenes.map((scene) =>
        scene.id === id ? { ...scene, ...patch } : scene,
      ),
    })),
  removeScene: (id) =>
    set((state) => ({
      scenes:
        state.scenes.length > 1
          ? state.scenes.filter((scene) => scene.id !== id)
          : state.scenes,
    })),
  setMusicUrl: (musicUrl) => set({ musicUrl }),
  setTemplate: (patch) =>
    set((state) => ({ template: { ...state.template, ...patch } })),
}));
