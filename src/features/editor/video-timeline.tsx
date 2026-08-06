"use client";
import { useQuery } from "@tanstack/react-query";
import { Music, Plus, Trash2 } from "lucide-react";
import { useEditorStore } from "./store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import { api } from "@/lib/api-client";
export function VideoTimeline() {
  const { scenes, musicUrl, setMusicUrl, addScene, updateScene, removeScene } =
    useEditorStore();
  const duration = scenes.reduce(
    (sum, scene) => sum + scene.durationSeconds,
    0,
  );
  const { data: assets = [] } = useQuery({
    queryKey: ["assets"],
    queryFn: () =>
      api<Array<{ id: string; name: string; type: string }>>("/api/v1/assets"),
  });
  return (
    <Card className="mb-5">
      <CardContent className="pt-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-black">Scene timeline</h2>
            <p className="text-xs text-[#7e828c]">
              {scenes.length} scenes · {duration.toFixed(1)} seconds · auto
              captions enabled
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={addScene}>
            <Plus size={15} />
            Add scene
          </Button>
        </div>
        <div className="grid gap-3 xl:grid-cols-2">
          {scenes.map((scene, index) => (
            <div
              key={scene.id}
              className="rounded-xl border border-[#e2e3e7] bg-[#fafafa] p-4"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-[#777c86]">
                  Scene {index + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeScene(scene.id)}
                  disabled={scenes.length === 1}
                  aria-label={`Remove scene ${index + 1}`}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
              <Label>On-screen script</Label>
              <Textarea
                className="min-h-20"
                value={scene.script}
                onChange={(e) =>
                  updateScene(scene.id, { script: e.target.value })
                }
              />
              <div className="mt-3">
                <Label>Scene background</Label>
                <select
                  className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-3 text-sm"
                  value={scene.backgroundAssetId ?? ""}
                  onChange={(event) =>
                    updateScene(scene.id, {
                      backgroundAssetId: event.target.value || undefined,
                    })
                  }
                >
                  <option value="">Brand gradient</option>
                  {assets
                    .filter((asset) => ["IMAGE", "VIDEO"].includes(asset.type))
                    .map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.name} · {asset.type}
                      </option>
                    ))}
                </select>
              </div>
              <div className="mt-3 grid grid-cols-[1fr_100px_120px] gap-2">
                <div>
                  <Label>Caption</Label>
                  <Input
                    value={scene.caption}
                    onChange={(e) =>
                      updateScene(scene.id, { caption: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Seconds</Label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    step={0.5}
                    value={scene.durationSeconds}
                    onChange={(e) =>
                      updateScene(scene.id, {
                        durationSeconds: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Transition</Label>
                  <select
                    className="h-11 w-full rounded-xl border border-[#dfe1e6] bg-white px-2 text-sm"
                    value={scene.transition}
                    onChange={(e) =>
                      updateScene(scene.id, {
                        transition: e.target.value as typeof scene.transition,
                      })
                    }
                  >
                    {["fade", "slide", "zoom"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <Label>
              <Music size={14} className="mr-1 inline" />
              Licensed music URL (optional)
            </Label>
            <Input
              type="url"
              value={musicUrl}
              onChange={(e) => setMusicUrl(e.target.value)}
              placeholder="https://cdn.example.com/licensed-track.mp3"
            />
          </div>
          <span className="pb-3 text-xs text-[#858994]">
            Voice-over and subtitles follow each scene script.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
