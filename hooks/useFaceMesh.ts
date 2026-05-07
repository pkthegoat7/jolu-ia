"use client";
import { useEffect, useRef, useCallback } from "react";
import type { FaceLandmarker, DrawingUtils } from "@mediapipe/tasks-vision";

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export function useFaceMesh(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onFaceDetected?: (detected: boolean) => void
) {
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const FLClassRef = useRef<typeof FaceLandmarker | null>(null);
  const DUClassRef = useRef<typeof DrawingUtils | null>(null);
  const drawingRef = useRef<DrawingUtils | null>(null);
  const animRef = useRef<number>(0);
  const runningRef = useRef(false);
  const onFaceRef = useRef(onFaceDetected);
  onFaceRef.current = onFaceDetected;
  const latestLandmarksRef = useRef<Array<{ x: number; y: number; z: number }> | null>(null);

  const loop = useCallback(() => {
    if (!runningRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = landmarkerRef.current;

    if (!video || !canvas || !landmarker || video.readyState < 2) {
      animRef.current = requestAnimationFrame(loop);
      return;
    }

    if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
    if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) { animRef.current = requestAnimationFrame(loop); return; }

    if (!drawingRef.current && DUClassRef.current) {
      drawingRef.current = new DUClassRef.current(ctx);
    }

    const results = landmarker.detectForVideo(video, performance.now());
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const detected: boolean = results.faceLandmarks.length > 0;
    latestLandmarksRef.current = detected ? results.faceLandmarks[0] : null;
    onFaceRef.current?.(detected);

    if (detected && drawingRef.current && FLClassRef.current) {
      const FL = FLClassRef.current;
      for (const lm of results.faceLandmarks) {
        drawingRef.current.drawConnectors(lm, FL.FACE_LANDMARKS_TESSELATION, {
          color: "rgba(185,111,141,0.22)",
          lineWidth: 0.6,
        });
        drawingRef.current.drawConnectors(lm, FL.FACE_LANDMARKS_FACE_OVAL, {
          color: "rgba(185,111,141,0.85)",
          lineWidth: 1.8,
        });
        drawingRef.current.drawConnectors(lm, FL.FACE_LANDMARKS_LEFT_EYE, {
          color: "rgba(185,111,141,0.85)",
          lineWidth: 1.5,
        });
        drawingRef.current.drawConnectors(lm, FL.FACE_LANDMARKS_RIGHT_EYE, {
          color: "rgba(185,111,141,0.85)",
          lineWidth: 1.5,
        });
        drawingRef.current.drawConnectors(lm, FL.FACE_LANDMARKS_LEFT_EYEBROW, {
          color: "rgba(185,111,141,0.85)",
          lineWidth: 1.5,
        });
        drawingRef.current.drawConnectors(
          lm,
          FL.FACE_LANDMARKS_RIGHT_EYEBROW,
          { color: "rgba(185,111,141,0.85)", lineWidth: 1.5 }
        );
        drawingRef.current.drawConnectors(lm, FL.FACE_LANDMARKS_LIPS, {
          color: "rgba(185,111,141,0.85)",
          lineWidth: 1.5,
        });
        if (FL.FACE_LANDMARKS_LEFT_IRIS) {
          drawingRef.current.drawConnectors(
            lm,
            FL.FACE_LANDMARKS_LEFT_IRIS,
            { color: "rgba(74,36,53,0.9)", lineWidth: 1.5 }
          );
        }
        if (FL.FACE_LANDMARKS_RIGHT_IRIS) {
          drawingRef.current.drawConnectors(
            lm,
            FL.FACE_LANDMARKS_RIGHT_IRIS,
            { color: "rgba(74,36,53,0.9)", lineWidth: 1.5 }
          );
        }
      }
    }

    animRef.current = requestAnimationFrame(loop);
  }, [videoRef, canvasRef]);

  const start = useCallback(async () => {
    if (landmarkerRef.current) {
      runningRef.current = true;
      animRef.current = requestAnimationFrame(loop);
      return;
    }

    const init = async (delegate: "GPU" | "CPU") => {
      const { FaceLandmarker, FilesetResolver, DrawingUtils } = await import(
        "@mediapipe/tasks-vision"
      );
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        outputFaceBlendshapes: false,
        runningMode: "VIDEO",
        numFaces: 1,
      });
      FLClassRef.current = FaceLandmarker;
      DUClassRef.current = DrawingUtils;
      landmarkerRef.current = landmarker;
    };

    try {
      await init("GPU");
    } catch {
      await init("CPU");
    }

    runningRef.current = true;
    animRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const stop = useCallback(() => {
    runningRef.current = false;
    cancelAnimationFrame(animRef.current);
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }
    drawingRef.current = null;
  }, [canvasRef]);

  useEffect(
    () => () => {
      stop();
      landmarkerRef.current?.close?.();
    },
    [stop]
  );

  const getLandmarks = useCallback(
    () => latestLandmarksRef.current,
    []
  );

  return { start, stop, getLandmarks };
}
