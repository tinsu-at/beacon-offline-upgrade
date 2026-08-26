import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Download, RefreshCw, RotateCcw, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/camera")({
  head: () => ({
    meta: [
      { title: "Camera — Beacon" },
      {
        name: "description",
        content: "Take a full-screen selfie with Beacon. Works on mobile and desktop.",
      },
      { property: "og:title", content: "Camera — Beacon" },
      {
        property: "og:description",
        content: "Take a full-screen selfie with Beacon. Works on mobile and desktop.",
      },
    ],
  }),
  component: CameraPage,
});

type Facing = "user" | "environment";

function CameraPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("user");
  const [shot, setShot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(
    async (mode: Facing) => {
      setError(null);
      setReady(false);
      stop();
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setError("This device or browser does not expose a camera.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: mode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        streamRef.current = stream;
        const el = videoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => {});
          setReady(true);
        }
      } catch {
        setError("Camera access was blocked. Allow camera permission and try again.");
      }
    },
    [stop],
  );

  useEffect(() => {
    void start(facing);
    return stop;
  }, [facing, start, stop]);

  function capture() {
    const el = videoRef.current;
    if (!el || !el.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (facing === "user") {
      // Mirror the selfie so it matches what the preview showed.
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
    setShot(canvas.toDataURL("image/jpeg", 0.92));
  }

  function save() {
    if (!shot) return;
    const a = document.createElement("a");
    a.href = shot;
    a.download = `beacon-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success("Photo saved");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Full-bleed preview: object-cover keeps the native aspect ratio without letterboxing. */}
      {shot ? (
        <img src={shot} alt="Captured photo" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={`absolute inset-0 h-full w-full object-cover ${
            facing === "user" ? "scale-x-[-1]" : ""
          }`}
        />
      )}

      {!ready && !shot && !error && (
        <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
          Starting camera…
        </div>
      )}

      {error && (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <div className="space-y-4">
            <p className="text-sm text-white/80">{error}</p>
            <button
              onClick={() => void start(facing)}
              className="inline-flex items-center gap-2 rounded-full bg-white/15 px-5 py-2 text-sm text-white"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        </div>
      )}

      <button
        onClick={() => {
          stop();
          void navigate({ to: "/dashboard" });
        }}
        aria-label="Close camera"
        className="safe-top absolute left-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-black/40 text-white backdrop-blur"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="safe-bottom absolute inset-x-0 bottom-0 flex items-center justify-center gap-8 bg-gradient-to-t from-black/70 to-transparent px-6 pb-8 pt-14">
        {shot ? (
          <>
            <button
              onClick={() => setShot(null)}
              aria-label="Retake"
              className="grid h-14 w-14 place-items-center rounded-full bg-white/15 text-white backdrop-blur"
            >
              <RotateCcw className="h-6 w-6" />
            </button>
            <button
              onClick={save}
              aria-label="Save photo"
              className="grid h-16 w-16 place-items-center rounded-full bg-white text-black"
            >
              <Download className="h-6 w-6" />
            </button>
          </>
        ) : (
          <>
            <span className="h-14 w-14" />
            <button
              onClick={capture}
              disabled={!ready}
              aria-label="Take photo"
              className="grid h-[72px] w-[72px] place-items-center rounded-full border-4 border-white/70 bg-white/90 text-black disabled:opacity-40"
            >
              <Camera className="h-6 w-6" />
            </button>
            <button
              onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
              aria-label="Switch camera"
              className="grid h-14 w-14 place-items-center rounded-full bg-white/15 text-white backdrop-blur"
            >
              <RefreshCw className="h-6 w-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
